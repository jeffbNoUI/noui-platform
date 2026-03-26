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
