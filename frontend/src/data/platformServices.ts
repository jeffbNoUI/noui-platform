// ─── Platform Service Catalog ────────────────────────────────────────────────
// Enriched version of the service catalog with build status tracking.
// Source of truth for the 30-service platform map.

export type Recommendation = 'BUILD' | 'HYBRID' | 'BUY';
export type PocStatus = true | 'proto' | false;
export type BuildStatus = 'complete' | 'in-progress' | 'planned' | 'deferred';

export interface PlatformService {
  name: string;
  category: string;
  rec: Recommendation;
  poc: PocStatus;
  desc: string;
  buildStatus: BuildStatus;
  completionPct: number;
  targetSprint?: number;
  backendService?: string;
  dependencies?: string[];
}

export const PLATFORM_SERVICES: PlatformService[] = [
  // ── Workflow & Process ───────────────────────────────────────────────────────
  {
    name: 'Process Orchestrator',
    category: 'Workflow & Process',
    rec: 'BUILD',
    poc: true,
    desc: 'Stage-based lifecycle with entry/exit criteria',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'casemanagement',
  },
  {
    name: 'Work Queue Management',
    category: 'Workflow & Process',
    rec: 'BUILD',
    poc: true,
    desc: 'Priority-driven case assignment and tracking',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'casemanagement',
  },
  {
    name: 'Task Scheduling & SLA',
    category: 'Workflow & Process',
    rec: 'BUILD',
    poc: false,
    desc: 'Deadline tracking, 15th-of-month cutoffs',
    buildStatus: 'planned',
    completionPct: 10,
    targetSprint: 8,
    dependencies: ['Process Orchestrator'],
  },
  {
    name: 'Business Rules Engine',
    category: 'Workflow & Process',
    rec: 'BUILD',
    poc: true,
    desc: 'Deterministic calculations, all tiers',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'intelligence',
  },

  // ── Case Management ──────────────────────────────────────────────────────────
  {
    name: 'Case Lifecycle',
    category: 'Case Management',
    rec: 'BUILD',
    poc: true,
    desc: 'Intake through certification',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'casemanagement',
  },
  {
    name: 'Document Tracking',
    category: 'Case Management',
    rec: 'HYBRID',
    poc: 'proto',
    desc: 'Required docs, receipt, verification',
    buildStatus: 'in-progress',
    completionPct: 60,
    targetSprint: 6,
    dependencies: ['Case Lifecycle'],
  },
  {
    name: 'Notes & Comments',
    category: 'Case Management',
    rec: 'BUILD',
    poc: false,
    desc: 'Case-level and stage-level notes',
    buildStatus: 'in-progress',
    completionPct: 50,
    targetSprint: 7,
    dependencies: ['Case Lifecycle'],
  },

  // ── Document Management ──────────────────────────────────────────────────────
  {
    name: 'Document Storage',
    category: 'Document Management',
    rec: 'BUY',
    poc: false,
    desc: 'Secure document repository',
    buildStatus: 'deferred',
    completionPct: 0,
  },
  {
    name: 'Template Engine',
    category: 'Document Management',
    rec: 'BUILD',
    poc: false,
    desc: 'Letters, notices, forms generation',
    buildStatus: 'in-progress',
    completionPct: 70,
    targetSprint: 5,
    backendService: 'correspondence',
  },
  {
    name: 'E-Signature',
    category: 'Document Management',
    rec: 'BUY',
    poc: false,
    desc: 'Electronic signature capture',
    buildStatus: 'deferred',
    completionPct: 0,
  },

  // ── Communication ────────────────────────────────────────────────────────────
  {
    name: 'Notification Engine',
    category: 'Communication',
    rec: 'BUILD',
    poc: false,
    desc: 'Email, SMS, in-app notifications',
    buildStatus: 'planned',
    completionPct: 5,
    targetSprint: 9,
  },
  {
    name: 'Correspondence Tracking',
    category: 'Communication',
    rec: 'BUILD',
    poc: false,
    desc: 'Inbound/outbound mail log',
    buildStatus: 'in-progress',
    completionPct: 60,
    targetSprint: 5,
    backendService: 'correspondence',
  },
  {
    name: 'CRM Integration',
    category: 'Communication',
    rec: 'HYBRID',
    poc: true,
    desc: 'Contact management and interaction history',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'crm',
  },

  // ── Reporting & Analytics ────────────────────────────────────────────────────
  {
    name: 'Executive Dashboard',
    category: 'Reporting & Analytics',
    rec: 'BUILD',
    poc: true,
    desc: 'KPIs, volume, system health',
    buildStatus: 'complete',
    completionPct: 100,
  },
  {
    name: 'Operational Reports',
    category: 'Reporting & Analytics',
    rec: 'HYBRID',
    poc: false,
    desc: 'Caseload, SLA, processing metrics',
    buildStatus: 'planned',
    completionPct: 0,
    targetSprint: 10,
  },
  {
    name: 'Actuarial Extracts',
    category: 'Reporting & Analytics',
    rec: 'HYBRID',
    poc: false,
    desc: 'Data feeds for actuarial valuations',
    buildStatus: 'deferred',
    completionPct: 0,
  },

  // ── Audit & Compliance ───────────────────────────────────────────────────────
  {
    name: 'Audit Trail',
    category: 'Audit & Compliance',
    rec: 'BUILD',
    poc: 'proto',
    desc: 'Immutable action log, regulatory compliance',
    buildStatus: 'in-progress',
    completionPct: 40,
    targetSprint: 7,
  },
  {
    name: 'QA Sampling',
    category: 'Audit & Compliance',
    rec: 'BUILD',
    poc: false,
    desc: 'Random case selection for quality review',
    buildStatus: 'deferred',
    completionPct: 0,
  },
  {
    name: 'Compliance Checker',
    category: 'Audit & Compliance',
    rec: 'BUILD',
    poc: false,
    desc: 'Rule validation against statutory requirements',
    buildStatus: 'planned',
    completionPct: 0,
    targetSprint: 11,
  },

  // ── Identity & Access ────────────────────────────────────────────────────────
  {
    name: 'Role-Based Access',
    category: 'Identity & Access',
    rec: 'HYBRID',
    poc: 'proto',
    desc: '9 role definitions, context-aware navigation',
    buildStatus: 'in-progress',
    completionPct: 60,
    targetSprint: 4,
  },
  {
    name: 'SSO Integration',
    category: 'Identity & Access',
    rec: 'BUY',
    poc: false,
    desc: 'Enterprise single sign-on',
    buildStatus: 'deferred',
    completionPct: 0,
  },
  {
    name: 'Member Authentication',
    category: 'Identity & Access',
    rec: 'BUY',
    poc: false,
    desc: 'Portal login for self-service',
    buildStatus: 'deferred',
    completionPct: 0,
  },

  // ── Data Management ──────────────────────────────────────────────────────────
  {
    name: 'Data Connector',
    category: 'Data Management',
    rec: 'BUILD',
    poc: true,
    desc: 'Schema discovery, legacy adapter',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'connector',
  },
  {
    name: 'Data Quality Engine',
    category: 'Data Management',
    rec: 'BUILD',
    poc: true,
    desc: 'Anomaly detection, statistical baselines',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'dataquality',
  },
  {
    name: 'ETL/Migration',
    category: 'Data Management',
    rec: 'HYBRID',
    poc: false,
    desc: 'Legacy data transformation',
    buildStatus: 'deferred',
    completionPct: 0,
  },

  // ── Digital Adoption ─────────────────────────────────────────────────────────
  {
    name: 'Guided Mode',
    category: 'Digital Adoption',
    rec: 'BUILD',
    poc: true,
    desc: 'Training wheels for new analysts',
    buildStatus: 'complete',
    completionPct: 100,
  },
  {
    name: 'Proficiency Tracking',
    category: 'Digital Adoption',
    rec: 'BUILD',
    poc: true,
    desc: 'Analyst skill progression',
    buildStatus: 'complete',
    completionPct: 100,
  },
  {
    name: 'Contextual Help',
    category: 'Digital Adoption',
    rec: 'BUILD',
    poc: true,
    desc: 'Stage-aware help panel with rule references',
    buildStatus: 'complete',
    completionPct: 100,
    backendService: 'knowledgebase',
  },

  // ── Infrastructure ───────────────────────────────────────────────────────────
  {
    name: 'API Gateway',
    category: 'Infrastructure',
    rec: 'BUY',
    poc: false,
    desc: 'Rate limiting, authentication, routing',
    buildStatus: 'deferred',
    completionPct: 0,
  },
  {
    name: 'Monitoring & Logging',
    category: 'Infrastructure',
    rec: 'BUY',
    poc: false,
    desc: 'Application observability',
    buildStatus: 'deferred',
    completionPct: 0,
  },
  {
    name: 'Backup & DR',
    category: 'Infrastructure',
    rec: 'BUY',
    poc: false,
    desc: 'Disaster recovery and data backup',
    buildStatus: 'deferred',
    completionPct: 0,
  },
];

// ─── Helper functions ──────────────────────────────────────────────────────────

/** Group services by category, preserving insertion order. */
export function getServicesByCategory(): Map<string, PlatformService[]> {
  const map = new Map<string, PlatformService[]>();
  for (const svc of PLATFORM_SERVICES) {
    const list = map.get(svc.category);
    if (list) {
      list.push(svc);
    } else {
      map.set(svc.category, [svc]);
    }
  }
  return map;
}

/** Weighted-average completion across all 30 services (0-100). */
export function getOverallCompletion(): number {
  if (PLATFORM_SERVICES.length === 0) return 0;
  const total = PLATFORM_SERVICES.reduce((sum, s) => sum + s.completionPct, 0);
  return Math.round(total / PLATFORM_SERVICES.length);
}

/** Average completion for a single category (0-100). */
export function getCategoryCompletion(category: string): number {
  const services = PLATFORM_SERVICES.filter((s) => s.category === category);
  if (services.length === 0) return 0;
  const total = services.reduce((sum, s) => sum + s.completionPct, 0);
  return Math.round(total / services.length);
}
