package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"log"
	"os"
	"time"

	"github.com/noui/platform/connector/monitor"
	"github.com/noui/platform/connector/schema"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	driver := flag.String("driver", "mysql", "Database driver: mysql | postgres | mssql")
	dsn := flag.String("dsn", "root:admin@tcp(127.0.0.1:3307)/_0919b4e09c48d335", "Data source name")
	dbName := flag.String("db", "", "Database name override (extracted from DSN if empty)")
	output := flag.String("output", "monitor-report.json", "Output JSON report path")
	baselineOnly := flag.Bool("baseline-only", false, "Only compute baselines, skip checks")
	checksOnly := flag.Bool("checks-only", false, "Only run checks, skip baseline computation")
	schedule := flag.String("schedule", "", "Run interval for periodic monitoring (e.g. 5m, 1h)")
	historyDir := flag.String("history-dir", "", "Directory for timestamped report history")
	thresholdsFile := flag.String("thresholds", "", "JSON file with configurable check thresholds")
	webhookURL := flag.String("webhook-url", "", "URL to POST webhook notifications on check status changes")
	manifestFile := flag.String("manifest", "", "Tagged schema manifest JSON for tag-driven monitoring")
	flag.Parse()

	database := *dbName
	if database == "" {
		database = monitor.ExtractDBFromDSN(*dsn)
	}

	log.Printf("Connecting to %s database (%s)...", *driver, database)
	sqlDriver := *driver
	if sqlDriver == "mssql" {
		sqlDriver = "sqlserver"
	}
	db, err := sql.Open(sqlDriver, *dsn)
	if err != nil {
		log.Fatalf("Failed to open connection: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected.")

	// Select adapter: tag-driven (from manifest) or traditional (from driver)
	var adapter monitor.MonitorAdapter
	if *manifestFile != "" {
		manifest, err := loadManifest(*manifestFile)
		if err != nil {
			log.Fatalf("Failed to load manifest: %v", err)
		}
		adapter = monitor.NewTagDrivenAdapter(manifest, *driver)
		log.Printf("Using tag-driven monitor adapter (manifest: %s, %d tables, driver: %s)",
			*manifestFile, manifest.TableCount, *driver)
	} else {
		adapter = monitor.NewMonitorAdapter(*driver)
		log.Printf("Using %s monitor adapter", *driver)
	}

	// Load thresholds
	th := monitor.DefaultThresholds()
	if *thresholdsFile != "" {
		th, err = monitor.LoadThresholds(*thresholdsFile)
		if err != nil {
			log.Fatalf("Failed to load thresholds: %v", err)
		}
		log.Printf("Loaded custom thresholds from %s", *thresholdsFile)
	}

	if *schedule != "" {
		interval, err := time.ParseDuration(*schedule)
		if err != nil {
			log.Fatalf("Invalid schedule interval %q: %v", *schedule, err)
		}
		monitor.RunScheduled(db, adapter, th, *driver, database, *output, *historyDir, interval, *baselineOnly, *checksOnly, *webhookURL)
		return
	}

	report, err := monitor.RunMonitor(db, adapter, th, *driver, database, *baselineOnly, *checksOnly)
	if err != nil {
		log.Fatalf("Monitor run failed: %v", err)
	}

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal report: %v", err)
	}

	if err := os.WriteFile(*output, data, 0644); err != nil {
		log.Fatalf("Failed to write output: %v", err)
	}

	log.Printf("Monitor report written to %s", *output)
}

// loadManifest reads a tagged schema manifest JSON file.
func loadManifest(path string) (schema.SchemaManifest, error) {
	var manifest schema.SchemaManifest
	data, err := os.ReadFile(path)
	if err != nil {
		return manifest, err
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return manifest, err
	}
	return manifest, nil
}
