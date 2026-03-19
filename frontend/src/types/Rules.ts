export interface RuleDefinition {
  id: string;
  name: string;
  domain: string;
  description: string;
  sourceReference: { document: string; section: string; lastVerified: string };
  appliesTo: { tiers: string[]; memberTypes: string[] };
  inputs: RuleParam[];
  logic: RuleLogic;
  output: RuleOutput[];
  dependencies: string[];
  tags: string[];
  testCases: RuleTestCase[];
  governance: RuleGovernance;
  testStatus?: TestStatus;
}

export interface RuleParam {
  name: string;
  type: string;
  description: string;
  constraints?: string;
}

export interface RuleLogic {
  type: 'conditional' | 'formula' | 'procedural' | 'lookup_table';
  conditions?: RuleCondition[];
  formula?: string;
  steps?: string[];
  table?: RuleTableRow[];
  notes?: string[];
}

export interface RuleCondition {
  condition: string;
  result: Record<string, unknown>;
  notes?: string[];
}

export interface RuleTableRow {
  key: string;
  values: Record<string, unknown>;
}

export interface RuleOutput {
  field: string;
  type: string;
  description?: string;
}

export interface RuleTestCase {
  name: string;
  demoCaseRef?: string;
  description?: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export interface RuleGovernance {
  status: string;
  lastReviewed: string;
  reviewedBy: string;
  effectiveDate: string;
}

export interface TestStatus {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  lastRun: string;
}

export interface TestReport {
  lastRun: string;
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  tests: TestResult[];
  byRule: Record<string, RuleTestSummary>;
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  ruleId?: string;
}

export interface RuleTestSummary {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  tests: TestResult[];
}

export interface DemoCase {
  caseId: string;
  description: string;
  member: {
    memberId: number | string;
    firstName: string;
    lastName: string;
    dob: string;
    hireDate: string;
    tier: number | string;
  };
  retirementDate: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  testPoints: string[];
  full: Record<string, unknown>;
}
