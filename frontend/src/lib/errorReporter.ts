// ─── Error Self-Reporter ────────────────────────────────────────────────────
// Fire-and-forget error reporting to the Issues service.
// Never blocks the user. Never throws its own errors.
// ────────────────────────────────────────────────────────────────────────────

const ISSUES_URL = import.meta.env.VITE_ISSUES_URL || '/api';
const REPORT_ENDPOINT = `${ISSUES_URL}/v1/errors/report`;

export interface ErrorReportPayload {
  requestId: string;
  url: string;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
  portal: string;
  route: string;
  componentStack?: string;
}

// Prevent duplicate reports for the same error within a short window
const recentFingerprints = new Set<string>();
const DEDUP_WINDOW_MS = 60_000; // 1 minute

function fingerprint(report: ErrorReportPayload): string {
  return `${report.errorCode}:${report.url}:${report.httpStatus}`;
}

/**
 * Report a user-facing error to the Issues service.
 * Fire-and-forget: never awaited, never throws.
 */
export function reportError(report: ErrorReportPayload): void {
  try {
    // Don't report errors from the error reporter itself
    if (report.url.includes('/errors/report')) return;

    // Client-side dedup: skip if we already reported this exact error recently
    const fp = fingerprint(report);
    if (recentFingerprints.has(fp)) return;
    recentFingerprints.add(fp);
    setTimeout(() => recentFingerprints.delete(fp), DEDUP_WINDOW_MS);

    // Fire and forget — uses raw fetch (no auth) so error reports work even
    // when the JWT has expired, which is often when errors occur.
    fetch(REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(() => {
      // Silently swallow — error reporting must never impact the user
    });
  } catch {
    // Defensive: catch any synchronous errors too
  }
}

/** Test-only: reset dedup state */
export function _resetForTesting(): void {
  recentFingerprints.clear();
}
