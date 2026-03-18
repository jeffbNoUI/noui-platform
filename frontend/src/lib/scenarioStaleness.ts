/**
 * Scenario staleness detection via data version hashing.
 *
 * When a member's underlying data changes (salary, service credit,
 * beneficiaries, plan config), saved scenarios become stale because
 * the results may no longer reflect current reality.
 *
 * `computeDataVersion` produces a deterministic hash from the member's
 * current data. Compare against a saved scenario's `data_version` field
 * to detect staleness.
 */

interface DataVersionInput {
  member_id: number;
  earned_years: number;
  purchased_years: number;
  military_years: number;
  beneficiary_count: number;
  plan_config_version: string;
}

/**
 * Compute a deterministic version string from member data.
 * Pure function — no side effects.
 */
export function computeDataVersion(input: DataVersionInput): string {
  // Build a canonical string from the input fields
  const canonical = [
    `m:${input.member_id}`,
    `e:${input.earned_years}`,
    `p:${input.purchased_years}`,
    `mil:${input.military_years}`,
    `b:${input.beneficiary_count}`,
    `cfg:${input.plan_config_version}`,
  ].join('|');

  return simpleHash(canonical);
}

/**
 * Check if a saved scenario is stale given current data.
 */
export function isScenarioStale(savedVersion: string, currentVersion: string): boolean {
  return savedVersion !== currentVersion;
}

/**
 * Simple deterministic hash for version strings.
 * Not cryptographic — just needs to detect changes.
 * Uses djb2 algorithm for consistency across environments.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  // Convert to unsigned hex string
  return 'dv-' + (hash >>> 0).toString(16);
}
