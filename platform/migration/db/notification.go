package db

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// ListNotifications returns the most recent notifications for a tenant.
func ListNotifications(db *sql.DB, tenantID string) ([]models.Notification, error) {
	rows, err := db.Query(
		`SELECT id, tenant_id, engagement_id, engagement_name, type, summary, read, created_at
		 FROM migration.notification
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	var notifs []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(
			&n.ID, &n.TenantID, &n.EngagementID, &n.EngagementName,
			&n.Type, &n.Summary, &n.Read, &n.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifs = append(notifs, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list notifications rows: %w", err)
	}
	return notifs, nil
}

// MarkNotificationRead marks a single notification as read.
func MarkNotificationRead(db *sql.DB, id string) error {
	_, err := db.Exec(`UPDATE migration.notification SET read = true WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	return nil
}

// MarkAllNotificationsRead marks all unread notifications for a tenant as read.
func MarkAllNotificationsRead(db *sql.DB, tenantID string) error {
	_, err := db.Exec(`UPDATE migration.notification SET read = true WHERE tenant_id = $1 AND read = false`, tenantID)
	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

// CreateNotification inserts a new notification record. Generic/reusable — not specific
// to any particular notification type. Used by drift detection (DRIFT_CRITICAL),
// migration lifecycle (M11a), and other subsystems.
func CreateNotification(database *sql.DB, tenantID, engagementID, engagementName, notifType, summary string) (*models.Notification, error) {
	if database == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var n models.Notification
	err := database.QueryRow(
		`INSERT INTO migration.notification (tenant_id, engagement_id, engagement_name, type, summary)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, tenant_id, engagement_id, engagement_name, type, summary, read, created_at`,
		tenantID, engagementID, engagementName, notifType, summary,
	).Scan(&n.ID, &n.TenantID, &n.EngagementID, &n.EngagementName,
		&n.Type, &n.Summary, &n.Read, &n.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}
	return &n, nil
}
