// Package report provides PDF rendering for migration reports using chromedp
// (headless Chrome). The Renderer interface allows test mocking without a real
// Chrome binary.
package report

import (
	"context"
)

// PDFOptions controls PDF output generation.
type PDFOptions struct {
	PageSize     string  // "A4" (default), "Letter", etc.
	Landscape    bool    // portrait by default
	HeaderHTML   string  // optional HTML header for each page
	FooterHTML   string  // optional HTML footer for each page
	MarginTop    float64 // in inches; default 0.4
	MarginBottom float64
	MarginLeft   float64
	MarginRight  float64
}

// DefaultPDFOptions returns sensible defaults for report generation.
func DefaultPDFOptions() PDFOptions {
	return PDFOptions{
		PageSize:     "A4",
		Landscape:    false,
		MarginTop:    0.4,
		MarginBottom: 0.6,
		MarginLeft:   0.4,
		MarginRight:  0.4,
	}
}

// Renderer converts HTML content into PDF bytes. Implementations include
// BrowserPool (production, uses chromedp) and mock renderers for testing.
type Renderer interface {
	RenderHTML(ctx context.Context, htmlContent string, opts PDFOptions) ([]byte, error)
}
