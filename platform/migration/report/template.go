package report

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
)

//go:embed templates/*.html
var templateFS embed.FS

// templateFuncs provides custom functions for HTML templates.
// confClass and approvalBadge return raw HTML for styling — they are safe
// because they use fixed strings and only interpolate the numeric/enum value.
var templateFuncs = template.FuncMap{
	"confClass": func(conf float64) template.HTML {
		pct := fmt.Sprintf("%.0f%%", conf*100)
		switch {
		case conf >= 0.85:
			return template.HTML(`<span class="conf-high">` + pct + `</span>`)
		case conf >= 0.50:
			return template.HTML(`<span class="conf-med">` + pct + `</span>`)
		default:
			return template.HTML(`<span class="conf-low">` + pct + `</span>`)
		}
	},
	"approvalBadge": func(status string) template.HTML {
		switch status {
		case "APPROVED":
			return template.HTML(`<span class="badge badge-approved">Approved</span>`)
		case "PROPOSED":
			return template.HTML(`<span class="badge badge-proposed">Pending</span>`)
		case "REJECTED":
			return template.HTML(`<span class="badge badge-rejected">Rejected</span>`)
		default:
			return template.HTML(`<span class="badge">` + template.HTMLEscapeString(status) + `</span>`)
		}
	},
	"scoreClass": func(score float64) template.HTML {
		pct := fmt.Sprintf("%.1f%%", score*100)
		switch {
		case score >= 0.95:
			return template.HTML(`<span class="score-green">` + pct + `</span>`)
		case score >= 0.80:
			return template.HTML(`<span class="score-yellow">` + pct + `</span>`)
		default:
			return template.HTML(`<span class="score-red">` + pct + `</span>`)
		}
	},
	"priorityBadge": func(priority string) template.HTML {
		switch priority {
		case "P1":
			return template.HTML(`<span class="badge badge-p1">P1</span>`)
		case "P2":
			return template.HTML(`<span class="badge badge-p2">P2</span>`)
		case "P3":
			return template.HTML(`<span class="badge badge-p3">P3</span>`)
		default:
			return template.HTML(`<span class="badge">` + template.HTMLEscapeString(priority) + `</span>`)
		}
	},
	"categoryBadge": func(category string) template.HTML {
		switch category {
		case "MATCH":
			return template.HTML(`<span class="badge badge-match">Match</span>`)
		case "MINOR":
			return template.HTML(`<span class="badge badge-minor">Minor</span>`)
		case "MAJOR":
			return template.HTML(`<span class="badge badge-major">Major</span>`)
		case "ERROR":
			return template.HTML(`<span class="badge badge-error">Error</span>`)
		default:
			return template.HTML(`<span class="badge">` + template.HTMLEscapeString(category) + `</span>`)
		}
	},
	"derefString": func(s *string) string {
		if s == nil {
			return "—"
		}
		return *s
	},
}

// RenderMappingSpecHTML renders the mapping specification report data into an
// HTML string suitable for PDF conversion. The data parameter should be a
// *MappingSpecReport (from the api package) or any struct matching the
// template's field names.
func RenderMappingSpecHTML(data interface{}) (string, error) {
	tmpl, err := template.New("mapping_spec.html").
		Funcs(templateFuncs).
		ParseFS(templateFS, "templates/mapping_spec.html")
	if err != nil {
		return "", fmt.Errorf("parse mapping spec template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute mapping spec template: %w", err)
	}
	return buf.String(), nil
}

// RenderLineageReportHTML renders the lineage traceability report into HTML.
func RenderLineageReportHTML(data interface{}) (string, error) {
	tmpl, err := template.New("lineage_report.html").
		Funcs(templateFuncs).
		ParseFS(templateFS, "templates/lineage_report.html")
	if err != nil {
		return "", fmt.Errorf("parse lineage report template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute lineage report template: %w", err)
	}
	return buf.String(), nil
}

// RenderReconciliationReportHTML renders the reconciliation summary report into HTML.
func RenderReconciliationReportHTML(data interface{}) (string, error) {
	tmpl, err := template.New("reconciliation_report.html").
		Funcs(templateFuncs).
		ParseFS(templateFS, "templates/reconciliation_report.html")
	if err != nil {
		return "", fmt.Errorf("parse reconciliation report template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute reconciliation report template: %w", err)
	}
	return buf.String(), nil
}
