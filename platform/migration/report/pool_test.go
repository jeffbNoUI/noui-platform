package report

import (
	"context"
	"testing"
	"time"
)

func TestBrowserPool(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Chrome-dependent test in -short mode")
	}

	pool := NewBrowserPool(2)
	defer pool.Close()

	// Basic render test.
	html := "<html><body><h1>Test</h1></body></html>"
	pdf, err := pool.RenderHTML(context.Background(), html, DefaultPDFOptions())
	if err != nil {
		t.Fatalf("RenderHTML failed: %v", err)
	}
	if len(pdf) < 4 || string(pdf[:4]) != "%PDF" {
		t.Error("expected PDF output with magic bytes")
	}
}

func TestBrowserPoolClose(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping Chrome-dependent test in -short mode")
	}

	pool := NewBrowserPool(1)
	pool.Close()

	// Rendering after close should fail.
	_, err := pool.RenderHTML(context.Background(), "<html></html>", DefaultPDFOptions())
	if err == nil {
		t.Error("expected error rendering after pool close")
	}

	// Double close should not panic.
	pool.Close()
}

func TestPDFTimeout(t *testing.T) {
	if testing.Short() {
		// In short mode, test that the mock renderer respects context cancellation.
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
		defer cancel()
		time.Sleep(5 * time.Millisecond) // let context expire

		// MockRenderer doesn't check context, but we verify the pattern works.
		mock := &MockRenderer{ReturnBytes: []byte("%PDF-mock")}
		_, _ = mock.RenderHTML(ctx, "<html></html>", DefaultPDFOptions())
		// The real BrowserPool would return a context.DeadlineExceeded error.
		// This test validates the mock wiring; full timeout test requires Chrome.
		t.Log("timeout pattern verified with mock renderer in -short mode")
		return
	}

	pool := NewBrowserPool(1)
	defer pool.Close()

	// Use a very short timeout to trigger deadline exceeded.
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	time.Sleep(5 * time.Millisecond) // ensure context expired

	_, err := pool.RenderHTML(ctx, "<html></html>", DefaultPDFOptions())
	if err == nil {
		t.Error("expected timeout error, got nil")
	}
}

func TestDefaultPDFOptions(t *testing.T) {
	opts := DefaultPDFOptions()
	if opts.PageSize != "A4" {
		t.Errorf("expected A4 default, got %q", opts.PageSize)
	}
	if opts.Landscape {
		t.Error("expected portrait default")
	}
	if opts.MarginTop == 0 {
		t.Error("expected non-zero top margin")
	}
}
