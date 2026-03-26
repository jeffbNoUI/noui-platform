package report

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// Compile-time check: BrowserPool implements Renderer.
var _ Renderer = (*BrowserPool)(nil)

// BrowserPool manages a bounded pool of headless Chrome contexts for
// concurrent PDF rendering. Concurrency is limited via a semaphore channel.
type BrowserPool struct {
	mu       sync.Mutex
	size     int
	sem      chan struct{}
	allocCtx context.Context
	cancelFn context.CancelFunc
	closed   bool
}

// NewBrowserPool creates a pool with the given concurrency limit.
// It starts a single shared Chrome allocator; each render creates a
// disposable browser context from it.
func NewBrowserPool(size int) *BrowserPool {
	if size < 1 {
		size = 2
	}

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)

	sem := make(chan struct{}, size)
	for i := 0; i < size; i++ {
		sem <- struct{}{}
	}

	slog.Info("browser pool created", "size", size)

	return &BrowserPool{
		size:     size,
		sem:      sem,
		allocCtx: allocCtx,
		cancelFn: allocCancel,
	}
}

// RenderHTML converts an HTML string to PDF bytes using a headless Chrome
// instance from the pool. The provided ctx controls the overall timeout.
func (p *BrowserPool) RenderHTML(ctx context.Context, htmlContent string, opts PDFOptions) ([]byte, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, fmt.Errorf("browser pool is closed")
	}
	p.mu.Unlock()

	// Acquire semaphore slot (bounded concurrency).
	select {
	case <-p.sem:
		defer func() { p.sem <- struct{}{} }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Determine timeout from caller context or default to 25s.
	timeout := 25 * time.Second
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < timeout {
			timeout = remaining
		}
	}

	// Create a new browser context from the shared allocator.
	taskCtx, taskCancel := chromedp.NewContext(p.allocCtx)
	defer taskCancel()

	taskCtx, timeoutCancel := context.WithTimeout(taskCtx, timeout)
	defer timeoutCancel()

	// Navigate to blank page, set HTML content, then print to PDF.
	var pdfBuf []byte
	err := chromedp.Run(taskCtx,
		chromedp.Navigate("about:blank"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			frameTree, err := page.GetFrameTree().Do(ctx)
			if err != nil {
				return err
			}
			return page.SetDocumentContent(frameTree.Frame.ID, htmlContent).Do(ctx)
		}),
		chromedp.ActionFunc(func(ctx context.Context) error {
			params := page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				WithDisplayHeaderFooter(opts.HeaderHTML != "" || opts.FooterHTML != "").
				WithHeaderTemplate(opts.HeaderHTML).
				WithFooterTemplate(opts.FooterHTML).
				WithMarginTop(opts.MarginTop).
				WithMarginBottom(opts.MarginBottom).
				WithMarginLeft(opts.MarginLeft).
				WithMarginRight(opts.MarginRight).
				WithLandscape(opts.Landscape)

			if opts.PageSize == "Letter" {
				params = params.WithPaperWidth(8.5).WithPaperHeight(11)
			} else {
				// A4: 8.27 x 11.69 inches
				params = params.WithPaperWidth(8.27).WithPaperHeight(11.69)
			}

			buf, _, err := params.Do(ctx)
			if err != nil {
				return err
			}
			pdfBuf = buf
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("chromedp render: %w", err)
	}

	return pdfBuf, nil
}

// Close shuts down all Chrome processes in the pool. Safe to call multiple times.
func (p *BrowserPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return
	}
	p.closed = true
	p.cancelFn()
	slog.Info("browser pool closed")
}
