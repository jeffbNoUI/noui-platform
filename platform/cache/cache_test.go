package cache

import (
	"testing"
	"time"
)

func TestGetMiss(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	_, ok := c.Get("nonexistent")
	if ok {
		t.Fatal("expected miss for nonexistent key")
	}

	stats := c.Stats()
	if stats.Misses != 1 {
		t.Fatalf("expected 1 miss, got %d", stats.Misses)
	}
}

func TestSetAndGet(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	c.Set("key1", "value1")

	val, ok := c.Get("key1")
	if !ok {
		t.Fatal("expected hit for key1")
	}
	if val.(string) != "value1" {
		t.Fatalf("expected value1, got %v", val)
	}

	stats := c.Stats()
	if stats.Hits != 1 {
		t.Fatalf("expected 1 hit, got %d", stats.Hits)
	}
	if stats.Size != 1 {
		t.Fatalf("expected size 1, got %d", stats.Size)
	}
}

func TestExpiration(t *testing.T) {
	c := New(50 * time.Millisecond)
	defer c.Stop()

	c.Set("key1", "value1")

	// Should be present immediately
	_, ok := c.Get("key1")
	if !ok {
		t.Fatal("expected hit before expiry")
	}

	// Wait for expiry
	time.Sleep(100 * time.Millisecond)

	_, ok = c.Get("key1")
	if ok {
		t.Fatal("expected miss after expiry")
	}
}

func TestInvalidate(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	c.Set("key1", "value1")
	c.Invalidate("key1")

	_, ok := c.Get("key1")
	if ok {
		t.Fatal("expected miss after invalidation")
	}
}

func TestInvalidateAll(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	c.Set("key1", "value1")
	c.Set("key2", "value2")
	c.Set("key3", "value3")

	c.InvalidateAll()

	stats := c.Stats()
	if stats.Size != 0 {
		t.Fatalf("expected empty cache, got size %d", stats.Size)
	}
}

func TestOverwrite(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	c.Set("key1", "original")
	c.Set("key1", "updated")

	val, ok := c.Get("key1")
	if !ok {
		t.Fatal("expected hit")
	}
	if val.(string) != "updated" {
		t.Fatalf("expected updated, got %v", val)
	}
}

func TestCleanupRemovesExpired(t *testing.T) {
	c := New(50 * time.Millisecond)
	defer c.Stop()

	c.Set("key1", "value1")
	c.Set("key2", "value2")

	// Wait for expiry + cleanup cycle
	time.Sleep(150 * time.Millisecond)

	stats := c.Stats()
	if stats.Size != 0 {
		t.Fatalf("expected cleanup to remove expired entries, got size %d", stats.Size)
	}
}

func TestStatsCounters(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	c.Set("a", 1)
	c.Get("a") // hit
	c.Get("a") // hit
	c.Get("b") // miss
	c.Get("c") // miss
	c.Get("c") // miss

	stats := c.Stats()
	if stats.Hits != 2 {
		t.Fatalf("expected 2 hits, got %d", stats.Hits)
	}
	if stats.Misses != 3 {
		t.Fatalf("expected 3 misses, got %d", stats.Misses)
	}
}

func TestConcurrentAccess(t *testing.T) {
	c := New(time.Minute)
	defer c.Stop()

	done := make(chan struct{})
	for i := 0; i < 100; i++ {
		go func(n int) {
			key := "key"
			c.Set(key, n)
			c.Get(key)
			c.Stats()
			done <- struct{}{}
		}(i)
	}

	for i := 0; i < 100; i++ {
		<-done
	}

	// No race detector failures = pass
}
