// connector/monitor — NoUI Monitoring Checks Engine
//
// Connects to a legacy database, establishes statistical baselines from
// historical data, and runs data quality checks to detect anomalies.
//
// Each check produces auditable results: every finding includes the
// signals/evidence that triggered it, per CLAUDE.md requirements.
//
// Types (CheckResult, Baseline, MonitorReport, ReportSummary) are defined
// in the shared schema package: github.com/noui/platform/connector/schema

package monitor
