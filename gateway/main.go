package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/har50/base-ai-tx-provider/gateway/middleware"
)

func main() {
	upstream := coalesceEnv(
		[]string{"UPSTREAM_URL", "FASTIFY_SERVICE_URL", "EXECUTION_SERVICE_URL"},
		"http://127.0.0.1:8787",
	)
	listen := env("GATEWAY_ADDR", "")
	if listen == "" {
		port := env("PORT", "8080")
		listen = ":" + port
	}
	redisURL := env("REDIS_URL", "")
	if redisURL != "" && !strings.Contains(redisURL, "://") {
		redisURL = "redis://" + redisURL
	}
	limit := envInt("RATE_LIMIT_PER_MIN", 0)
	if limit == 0 {
		limit = envInt("MAX_REQUESTS_PER_MINUTE", 60)
	}
	failLimit := envInt("CIRCUIT_FAIL_LIMIT", 10)
	failWindowSec := envInt("CIRCUIT_WINDOW_SEC", 60)
	window := time.Minute
	failWindow := time.Duration(failWindowSec) * time.Second

	apiKeyEnv := coalesceEnv([]string{"API_KEYS", "GATEWAY_AUTH_SECRET"}, "dev-agent-key")
	apiKeys := strings.Split(apiKeyEnv, ",")
	allowed := map[string]struct{}{}
	for _, k := range apiKeys {
		k = strings.TrimSpace(k)
		if k != "" {
			allowed[k] = struct{}{}
		}
	}

	var lim middleware.Limiter = middleware.NewMemoryLimiter(limit, failLimit, window, failWindow)
	if redisURL != "" {
		rl, err := middleware.NewRedisLimiter(redisURL, limit, failLimit, window, failWindow)
		if err != nil {
			log.Printf("Redis unavailable (%v) — falling back to in-memory limiter", err)
		} else {
			lim = rl
			log.Printf("Redis rate-limiter connected (%s)", redisURL)
		}
	}

	target, err := url.Parse(upstream)
	if err != nil {
		log.Fatalf("invalid UPSTREAM_URL: %v", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"gateway":  "go",
			"upstream": upstream,
			"limiter":  lim.Backend(),
		})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			auth := r.Header.Get("Authorization")
			if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
				key = strings.TrimSpace(auth[7:])
			}
		}
		if key == "" {
			key = r.RemoteAddr
		}
		if _, ok := allowed[key]; !ok {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		ctx := r.Context()
		ok, err := lim.Allow(ctx, key)
		if err != nil {
			log.Printf("limiter error: %v", err)
			http.Error(w, `{"error":"Rate limit service error"}`, http.StatusServiceUnavailable)
			return
		}
		if !ok {
			retry := middleware.FormatRetryAfter(window)
			w.Header().Set("Retry-After", retry)
			http.Error(w, `{"error":"Rate limit exceeded","retry_after":`+retry+`}`, http.StatusTooManyRequests)
			return
		}

		rec := &middleware.StatusRecorder{ResponseWriter: w, Status: 200}
		proxy.ServeHTTP(rec, r)
		if rec.Status == 422 || rec.Status >= 500 {
			tripped, _ := lim.RecordFailure(ctx, key)
			if tripped {
				log.Printf("circuit open for agent key prefix=%s", safePrefix(key))
			}
		}
	})

	log.Printf("Go gateway listening on %s → %s (limiter=%s limit=%d/min circuit=%d/%ds)",
		listen, upstream, lim.Backend(), limit, failLimit, failWindowSec)
	if err := http.ListenAndServe(listen, mux); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func coalesceEnv(keys []string, def string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return def
}

func envInt(k string, def int) int {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func safePrefix(key string) string {
	if len(key) < 6 {
		return key
	}
	return key[:6]
}
