package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/noui/platform/connector/dashboard"
)

func main() {
	port := flag.Int("port", 8090, "HTTP server port")
	reportFile := flag.String("report-file", "", "Path to monitor-report.json (required)")
	historyDir := flag.String("history-dir", "", "Directory containing timestamped history reports (for trend analysis)")
	flag.Parse()

	if *reportFile == "" {
		fmt.Fprintln(os.Stderr, "Error: --report-file is required")
		flag.Usage()
		os.Exit(1)
	}

	srv := dashboard.NewServer(*reportFile, *historyDir)

	if err := srv.LoadReport(); err != nil {
		log.Printf("Warning: could not load initial report: %v", err)
		log.Println("Server will start with no report loaded. Use ?refresh=true to retry.")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)

	go func() {
		sig := <-sigCh
		log.Printf("Received %v, initiating shutdown...", sig)
		cancel()
	}()

	addr := fmt.Sprintf(":%d", *port)
	if err := srv.ListenAndServe(ctx, addr); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
