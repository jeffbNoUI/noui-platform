// Package cache provides a simple in-memory TTL cache for rarely-changing data.
// Designed for small datasets (KB articles, stage definitions) where entries
// expire after a fixed duration rather than being evicted by memory pressure.
package cache

import (
	"context"
	"sync"
	"time"
)

// entry holds a cached value with its expiration time.
type entry struct {
	value     interface{}
	expiresAt time.Time
}

// Cache is a thread-safe in-memory TTL cache.
type Cache struct {
	mu      sync.RWMutex
	items   map[string]entry
	ttl     time.Duration
	hits    int64
	misses  int64
	stopCtx context.Context
	stop    context.CancelFunc
}

// Stats holds cache performance counters.
type Stats struct {
	Size   int   `json:"size"`
	Hits   int64 `json:"hits"`
	Misses int64 `json:"misses"`
}

// New creates a cache with the given TTL and starts a background cleanup goroutine.
// Call Stop() to release the cleanup goroutine when the cache is no longer needed.
func New(ttl time.Duration) *Cache {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Cache{
		items:   make(map[string]entry),
		ttl:     ttl,
		stopCtx: ctx,
		stop:    cancel,
	}
	go c.cleanup(ctx)
	return c
}

// Get returns the cached value for key, or nil and false if not found or expired.
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	e, ok := c.items[key]
	c.mu.RUnlock()

	if !ok || time.Now().After(e.expiresAt) {
		c.mu.Lock()
		c.misses++
		// Delete if expired (double-check under write lock)
		if ok && time.Now().After(e.expiresAt) {
			delete(c.items, key)
		}
		c.mu.Unlock()
		return nil, false
	}

	c.mu.Lock()
	c.hits++
	c.mu.Unlock()
	return e.value, true
}

// Set stores a value with the cache's default TTL.
func (c *Cache) Set(key string, value interface{}) {
	c.mu.Lock()
	c.items[key] = entry{
		value:     value,
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

// Invalidate removes a specific key from the cache.
func (c *Cache) Invalidate(key string) {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
}

// InvalidateAll clears all entries from the cache.
func (c *Cache) InvalidateAll() {
	c.mu.Lock()
	c.items = make(map[string]entry)
	c.mu.Unlock()
}

// Stats returns current cache performance counters.
func (c *Cache) Stats() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return Stats{
		Size:   len(c.items),
		Hits:   c.hits,
		Misses: c.misses,
	}
}

// Stop terminates the background cleanup goroutine.
func (c *Cache) Stop() {
	c.stop()
}

// cleanup periodically removes expired entries.
func (c *Cache) cleanup(ctx context.Context) {
	ticker := time.NewTicker(c.ttl)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.removeExpired()
		}
	}
}

// removeExpired deletes all entries past their expiration time.
func (c *Cache) removeExpired() {
	now := time.Now()
	c.mu.Lock()
	for k, e := range c.items {
		if now.After(e.expiresAt) {
			delete(c.items, k)
		}
	}
	c.mu.Unlock()
}
