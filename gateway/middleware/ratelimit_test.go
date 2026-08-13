package middleware

import (
	"context"
	"testing"
	"time"
)

func TestMemoryLimiterAllow(t *testing.T) {
	lim := NewMemoryLimiter(2, 5, time.Second, time.Minute)
	ctx := context.Background()
	ok, err := lim.Allow(ctx, "a")
	if err != nil || !ok {
		t.Fatalf("first allow: ok=%v err=%v", ok, err)
	}
	ok, err = lim.Allow(ctx, "a")
	if err != nil || !ok {
		t.Fatalf("second allow: ok=%v err=%v", ok, err)
	}
	ok, err = lim.Allow(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expected third request to be denied")
	}
}
