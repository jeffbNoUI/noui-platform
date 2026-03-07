// connector/monitor — NoUI Monitoring Checks Engine
//
// Connects to a legacy database, establishes statistical baselines from
// historical data, and runs data quality checks to detect anomalies.

package monitor

import "strings"

// ExtractDBFromDSN extracts the database name from a MySQL DSN string.
// DSN format: user:password@tcp(host:port)/dbname
func ExtractDBFromDSN(dsn string) string {
	// Find the last "/" and take everything after it (before any "?" params)
	slashIdx := strings.LastIndex(dsn, "/")
	if slashIdx < 0 || slashIdx >= len(dsn)-1 {
		return ""
	}
	dbPart := dsn[slashIdx+1:]
	// Strip query parameters
	if qIdx := strings.Index(dbPart, "?"); qIdx >= 0 {
		dbPart = dbPart[:qIdx]
	}
	return dbPart
}
