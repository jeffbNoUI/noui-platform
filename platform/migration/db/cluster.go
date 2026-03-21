package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// ListExceptionClusters returns all exception clusters for a batch.
func ListExceptionClusters(db *sql.DB, batchID string) ([]models.ExceptionCluster, error) {
	rows, err := db.Query(
		`SELECT cluster_id, batch_id, exception_type, field_name, count,
		        sample_source_ids, root_cause_pattern, suggested_resolution,
		        suggested_disposition, confidence, applied, applied_at
		 FROM migration.exception_cluster
		 WHERE batch_id = $1
		 ORDER BY count DESC`,
		batchID,
	)
	if err != nil {
		return nil, fmt.Errorf("list exception clusters: %w", err)
	}
	defer rows.Close()

	var clusters []models.ExceptionCluster
	for rows.Next() {
		var c models.ExceptionCluster
		if err := rows.Scan(
			&c.ClusterID, &c.BatchID, &c.ExceptionType, &c.FieldName, &c.Count,
			&c.SampleSourceIDs, &c.RootCausePattern, &c.SuggestedResolution,
			&c.SuggestedDisposition, &c.Confidence, &c.Applied, &c.AppliedAt,
		); err != nil {
			return nil, fmt.Errorf("scan exception cluster: %w", err)
		}
		clusters = append(clusters, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list exception clusters rows: %w", err)
	}
	return clusters, nil
}

// ApplyCluster applies a cluster's suggested resolution by updating matching exceptions
// and marking the cluster as applied.
func ApplyCluster(db *sql.DB, clusterID string) (*models.ExceptionCluster, error) {
	// First get the cluster to know batch_id, exception_type, and field_name.
	var c models.ExceptionCluster
	err := db.QueryRow(
		`SELECT cluster_id, batch_id, exception_type, field_name, count,
		        sample_source_ids, root_cause_pattern, suggested_resolution,
		        suggested_disposition, confidence, applied, applied_at
		 FROM migration.exception_cluster
		 WHERE cluster_id = $1`,
		clusterID,
	).Scan(
		&c.ClusterID, &c.BatchID, &c.ExceptionType, &c.FieldName, &c.Count,
		&c.SampleSourceIDs, &c.RootCausePattern, &c.SuggestedResolution,
		&c.SuggestedDisposition, &c.Confidence, &c.Applied, &c.AppliedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get cluster for apply: %w", err)
	}

	if c.Applied {
		return nil, fmt.Errorf("cluster already applied")
	}

	disposition := "DEFERRED"
	if c.SuggestedDisposition != nil {
		disposition = *c.SuggestedDisposition
	}

	// Update matching exceptions.
	_, err = db.Exec(
		`UPDATE migration.exception
		 SET disposition = $1
		 WHERE batch_id = $2 AND exception_type = $3 AND field_name = $4 AND disposition = 'PENDING'`,
		disposition, c.BatchID, c.ExceptionType, c.FieldName,
	)
	if err != nil {
		return nil, fmt.Errorf("apply cluster update exceptions: %w", err)
	}

	// Mark cluster as applied.
	err = db.QueryRow(
		`UPDATE migration.exception_cluster
		 SET applied = true, applied_at = now()
		 WHERE cluster_id = $1
		 RETURNING cluster_id, batch_id, exception_type, field_name, count,
		           sample_source_ids, root_cause_pattern, suggested_resolution,
		           suggested_disposition, confidence, applied, applied_at`,
		clusterID,
	).Scan(
		&c.ClusterID, &c.BatchID, &c.ExceptionType, &c.FieldName, &c.Count,
		&c.SampleSourceIDs, &c.RootCausePattern, &c.SuggestedResolution,
		&c.SuggestedDisposition, &c.Confidence, &c.Applied, &c.AppliedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("apply cluster mark applied: %w", err)
	}
	return &c, nil
}
