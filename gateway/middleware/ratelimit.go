package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Limiter enforces sliding-window rate limits and a failure circuit breaker.
type Limiter interface {
	Allow(ctx context.Context, key string) (bool, error)
	RecordFailure(ctx context.Context, key string) (tripped bool, err error)
	Backend() string
}

type MemoryLimiter struct {
	mu         sync.Mutex
	hits       map[string][]time.Time
	fails      map[string][]time.Time
	limit      int
	window     time.Duration
	failLimit  int
	failWindow time.Duration
}

func NewMemoryLimiter(limit, failLimit int, window, failWindow time.Duration) *MemoryLimiter {
	return &MemoryLimiter{
		hits:       make(map[string][]time.Time),
		fails:      make(map[string][]time.Time),
		limit:      limit,
		window:     window,
		failLimit:  failLimit,
		failWindow: failWindow,
	}
}

func prune(ts []time.Time, cutoff time.Time) []time.Time {
	out := ts[:0]
	for _, t := range ts {
		if t.After(cutoff) {
			out = append(out, t)
		}
	}
	return out
}

func (r *MemoryLimiter) Allow(_ context.Context, key string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	r.hits[key] = prune(r.hits[key], now.Add(-r.window))
	if len(r.hits[key]) >= r.limit {
		return false, nil
	}
	r.hits[key] = append(r.hits[key], now)
	r.fails[key] = prune(r.fails[key], now.Add(-r.failWindow))
	if len(r.fails[key]) >= r.failLimit {
		return false, nil
	}
	return true, nil
}

func (r *MemoryLimiter) RecordFailure(_ context.Context, key string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	r.fails[key] = prune(r.fails[key], now.Add(-r.failWindow))
	r.fails[key] = append(r.fails[key], now)
	return len(r.fails[key]) >= r.failLimit, nil
}

func (r *MemoryLimiter) Backend() string { return "memory" }

type RedisLimiter struct {
	rdb        *redis.Client
	limit      int
	window     time.Duration
	failLimit  int
	failWindow time.Duration
}

func NewRedisLimiter(urlStr string, limit, failLimit int, window, failWindow time.Duration) (*RedisLimiter, error) {
	opt, err := redis.ParseURL(urlStr)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &RedisLimiter{
		rdb: rdb, limit: limit, window: window,
		failLimit: failLimit, failWindow: failWindow,
	}, nil
}

func (r *RedisLimiter) Allow(ctx context.Context, key string) (bool, error) {
	now := time.Now()
	rk := "rate_limit:" + key
	pipe := r.rdb.Pipeline()
	pipe.ZRemRangeByScore(ctx, rk, "0", strconv.FormatInt(now.Add(-r.window).UnixMilli(), 10))
	pipe.ZCard(ctx, rk)
	pipe.ZAdd(ctx, rk, redis.Z{Score: float64(now.UnixMilli()), Member: now.UnixNano()})
	pipe.PExpire(ctx, rk, r.window)
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	count := cmds[1].(*redis.IntCmd).Val()
	if count >= int64(r.limit) {
		return false, nil
	}
	fk := "circuit:" + key
	fails, err := r.rdb.ZCount(ctx, fk, strconv.FormatInt(now.Add(-r.failWindow).UnixMilli(), 10), "+inf").Result()
	if err != nil {
		return false, err
	}
	if fails >= int64(r.failLimit) {
		return false, nil
	}
	return true, nil
}

func (r *RedisLimiter) RecordFailure(ctx context.Context, key string) (bool, error) {
	now := time.Now()
	fk := "circuit:" + key
	pipe := r.rdb.Pipeline()
	pipe.ZRemRangeByScore(ctx, fk, "0", strconv.FormatInt(now.Add(-r.failWindow).UnixMilli(), 10))
	pipe.ZAdd(ctx, fk, redis.Z{Score: float64(now.UnixMilli()), Member: now.UnixNano()})
	pipe.PExpire(ctx, fk, r.failWindow)
	pipe.ZCard(ctx, fk)
	cmds, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	count := cmds[3].(*redis.IntCmd).Val()
	return count >= int64(r.failLimit), nil
}

func (r *RedisLimiter) Backend() string { return "redis" }

// StatusRecorder captures upstream status codes for the circuit breaker.
type StatusRecorder struct {
	http.ResponseWriter
	Status int
}

func (s *StatusRecorder) WriteHeader(code int) {
	s.Status = code
	s.ResponseWriter.WriteHeader(code)
}

func FormatRetryAfter(window time.Duration) string {
	return fmt.Sprintf("%.0f", window.Seconds())
}
