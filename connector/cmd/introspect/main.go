package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"log"
	"os"

	"github.com/noui/platform/connector/introspect"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	driver := flag.String("driver", "mysql", "Database driver: mysql | postgres | mssql")
	dsn := flag.String("dsn", "root:admin@tcp(127.0.0.1:3307)/", "Data source name")
	dbName := flag.String("db", "", "Database/schema name to introspect (auto-detected if empty)")
	output := flag.String("output", "manifest.json", "Output file path")
	flag.Parse()

	log.Printf("Connecting to %s database...", *driver)
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

	adapter := introspect.NewAdapter(*driver)
	manifest, err := introspect.Introspect(db, adapter, *driver, *dbName)
	if err != nil {
		log.Fatalf("Introspection failed: %v", err)
	}

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal manifest: %v", err)
	}
	if err := os.WriteFile(*output, data, 0644); err != nil {
		log.Fatalf("Failed to write output: %v", err)
	}

	log.Printf("Schema manifest written to %s", *output)
	log.Printf("Tables discovered: %d", manifest.TableCount)
}
