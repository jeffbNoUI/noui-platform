package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/crm/models"
)

// GetTaxonomyTree returns the full category taxonomy as a tree for a tenant.
func (s *Store) GetTaxonomyTree(tenantID string) ([]models.CategoryTaxonomy, error) {
	query := `
		SELECT
			category_id, tenant_id, parent_id,
			category_code, display_name, description,
			sort_order, is_active
		FROM crm_category_taxonomy
		WHERE tenant_id = $1 AND is_active = true
		ORDER BY sort_order, display_name`

	rows, err := s.DB.Query(query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("querying taxonomy: %w", err)
	}
	defer rows.Close()

	var all []models.CategoryTaxonomy
	for rows.Next() {
		var c models.CategoryTaxonomy
		var parentID sql.NullString
		var description sql.NullString

		err := rows.Scan(
			&c.CategoryID, &c.TenantID, &parentID,
			&c.Code, &c.DisplayName, &description,
			&c.SortOrder, &c.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning taxonomy row: %w", err)
		}

		c.ParentID = nullStringToPtr(parentID)
		c.Description = nullStringToPtr(description)
		all = append(all, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating taxonomy rows: %w", err)
	}

	return buildTree(all), nil
}

// buildTree assembles flat categories into a parent-child tree.
func buildTree(categories []models.CategoryTaxonomy) []models.CategoryTaxonomy {
	byID := make(map[string]*models.CategoryTaxonomy)
	for i := range categories {
		categories[i].Children = []models.CategoryTaxonomy{}
		byID[categories[i].CategoryID] = &categories[i]
	}

	var roots []models.CategoryTaxonomy
	for i := range categories {
		if categories[i].ParentID == nil {
			roots = append(roots, categories[i])
		} else {
			parent, ok := byID[*categories[i].ParentID]
			if ok {
				parent.Children = append(parent.Children, categories[i])
			} else {
				roots = append(roots, categories[i])
			}
		}
	}

	// Propagate children back to roots
	var result []models.CategoryTaxonomy
	for _, r := range roots {
		if node, ok := byID[r.CategoryID]; ok {
			result = append(result, *node)
		} else {
			result = append(result, r)
		}
	}

	return result
}
