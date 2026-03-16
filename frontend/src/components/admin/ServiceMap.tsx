import { useState } from 'react';
import ServiceMapLayers from './ServiceMapLayers';

type Recommendation = 'BUILD' | 'HYBRID' | 'BUY';
type PocStatus = true | 'proto' | false;

interface Service {
  name: string;
  rec: Recommendation;
  poc: PocStatus;
  desc: string;
}

interface Category {
  cat: string;
  services: Service[];
}

const SERVICES: Category[] = [
  {
    cat: 'Workflow & Process',
    services: [
      {
        name: 'Process Orchestrator',
        rec: 'BUILD',
        poc: true,
        desc: 'Stage-based lifecycle with entry/exit criteria',
      },
      {
        name: 'Work Queue Management',
        rec: 'BUILD',
        poc: true,
        desc: 'Priority-driven case assignment and tracking',
      },
      {
        name: 'Task Scheduling & SLA',
        rec: 'BUILD',
        poc: false,
        desc: 'Deadline tracking, 15th-of-month cutoffs',
      },
      {
        name: 'Business Rules Engine',
        rec: 'BUILD',
        poc: true,
        desc: 'Deterministic calculations, all tiers',
      },
    ],
  },
  {
    cat: 'Case Management',
    services: [
      { name: 'Case Lifecycle', rec: 'BUILD', poc: true, desc: 'Intake through certification' },
      {
        name: 'Document Tracking',
        rec: 'HYBRID',
        poc: 'proto',
        desc: 'Required docs, receipt, verification',
      },
      {
        name: 'Notes & Comments',
        rec: 'BUILD',
        poc: false,
        desc: 'Case-level and stage-level notes',
      },
    ],
  },
  {
    cat: 'Document Management',
    services: [
      { name: 'Document Storage', rec: 'BUY', poc: false, desc: 'Secure document repository' },
      {
        name: 'Template Engine',
        rec: 'BUILD',
        poc: false,
        desc: 'Letters, notices, forms generation',
      },
      { name: 'E-Signature', rec: 'BUY', poc: false, desc: 'Electronic signature capture' },
    ],
  },
  {
    cat: 'Communication',
    services: [
      {
        name: 'Notification Engine',
        rec: 'BUILD',
        poc: false,
        desc: 'Email, SMS, in-app notifications',
      },
      {
        name: 'Correspondence Tracking',
        rec: 'BUILD',
        poc: false,
        desc: 'Inbound/outbound mail log',
      },
      {
        name: 'CRM Integration',
        rec: 'HYBRID',
        poc: true,
        desc: 'Contact management and interaction history',
      },
    ],
  },
  {
    cat: 'Reporting & Analytics',
    services: [
      { name: 'Executive Dashboard', rec: 'BUILD', poc: true, desc: 'KPIs, volume, system health' },
      {
        name: 'Operational Reports',
        rec: 'HYBRID',
        poc: false,
        desc: 'Caseload, SLA, processing metrics',
      },
      {
        name: 'Actuarial Extracts',
        rec: 'HYBRID',
        poc: false,
        desc: 'Data feeds for actuarial valuations',
      },
    ],
  },
  {
    cat: 'Audit & Compliance',
    services: [
      {
        name: 'Audit Trail',
        rec: 'BUILD',
        poc: 'proto',
        desc: 'Immutable action log, regulatory compliance',
      },
      {
        name: 'QA Sampling',
        rec: 'BUILD',
        poc: false,
        desc: 'Random case selection for quality review',
      },
      {
        name: 'Compliance Checker',
        rec: 'BUILD',
        poc: false,
        desc: 'Rule validation against statutory requirements',
      },
    ],
  },
  {
    cat: 'Identity & Access',
    services: [
      {
        name: 'Role-Based Access',
        rec: 'HYBRID',
        poc: 'proto',
        desc: '9 role definitions, context-aware navigation',
      },
      { name: 'SSO Integration', rec: 'BUY', poc: false, desc: 'Enterprise single sign-on' },
      {
        name: 'Member Authentication',
        rec: 'BUY',
        poc: false,
        desc: 'Portal login for self-service',
      },
    ],
  },
  {
    cat: 'Data Management',
    services: [
      { name: 'Data Connector', rec: 'BUILD', poc: true, desc: 'Schema discovery, legacy adapter' },
      {
        name: 'Data Quality Engine',
        rec: 'BUILD',
        poc: true,
        desc: 'Anomaly detection, statistical baselines',
      },
      { name: 'ETL/Migration', rec: 'HYBRID', poc: false, desc: 'Legacy data transformation' },
    ],
  },
  {
    cat: 'Digital Adoption',
    services: [
      { name: 'Guided Mode', rec: 'BUILD', poc: true, desc: 'Training wheels for new analysts' },
      { name: 'Proficiency Tracking', rec: 'BUILD', poc: true, desc: 'Analyst skill progression' },
      {
        name: 'Contextual Help',
        rec: 'BUILD',
        poc: true,
        desc: 'Stage-aware help panel with rule references',
      },
    ],
  },
  {
    cat: 'Infrastructure',
    services: [
      {
        name: 'API Gateway',
        rec: 'BUY',
        poc: false,
        desc: 'Rate limiting, authentication, routing',
      },
      { name: 'Monitoring & Logging', rec: 'BUY', poc: false, desc: 'Application observability' },
      { name: 'Backup & DR', rec: 'BUY', poc: false, desc: 'Disaster recovery and data backup' },
    ],
  },
];

const REC_STYLES: Record<Recommendation, string> = {
  BUILD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HYBRID: 'bg-blue-50 text-blue-700 border-blue-200',
  BUY: 'bg-gray-50 text-gray-600 border-gray-200',
};

const POC_STYLES: Record<string, string> = {
  true: 'bg-emerald-50 text-emerald-700',
  proto: 'bg-blue-50 text-blue-700',
  false: 'bg-gray-50 text-gray-500',
};

const POC_LABELS: Record<string, string> = {
  true: 'IN POC',
  proto: 'PROTOTYPE',
  false: 'DEFERRED',
};

/**
 * Platform Service Map — 30 services, 10 categories, BUILD/HYBRID/BUY classification.
 */
export default function ServiceMap() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Workflow & Process']));

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const totalServices = SERVICES.reduce((a, c) => a + c.services.length, 0);
  const buildCount = SERVICES.reduce(
    (a, c) => a + c.services.filter((s) => s.rec === 'BUILD').length,
    0,
  );
  const hybridCount = SERVICES.reduce(
    (a, c) => a + c.services.filter((s) => s.rec === 'HYBRID').length,
    0,
  );
  const buyCount = SERVICES.reduce(
    (a, c) => a + c.services.filter((s) => s.rec === 'BUY').length,
    0,
  );
  const pocCount = SERVICES.reduce(
    (a, c) => a + c.services.filter((s) => s.poc === true).length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Services', value: totalServices, color: 'text-iw-navy' },
          { label: 'BUILD', value: buildCount, color: 'text-emerald-600' },
          { label: 'HYBRID', value: hybridCount, color: 'text-blue-600' },
          { label: 'BUY', value: buyCount, color: 'text-gray-600' },
          { label: 'In POC', value: pocCount, color: 'text-iw-sage' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {s.label}
            </div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Architecture layers */}
      <ServiceMapLayers />

      {/* Service catalog */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Service Catalog</h3>
          <div className="flex gap-2">
            {(['BUILD', 'HYBRID', 'BUY'] as Recommendation[]).map((r) => (
              <span
                key={r}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REC_STYLES[r]}`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {SERVICES.map((category) => {
          const isExpanded = expanded.has(category.cat);
          const counts = { BUILD: 0, HYBRID: 0, BUY: 0 };
          category.services.forEach((s) => counts[s.rec]++);

          return (
            <div key={category.cat}>
              <button
                onClick={() => toggle(category.cat)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  isExpanded ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{isExpanded ? '\u25bc' : '\u25b6'}</span>
                  <span className="text-sm font-semibold text-gray-700">{category.cat}</span>
                  <span className="text-[10px] text-gray-400">({category.services.length})</span>
                </div>
                <div className="flex gap-1.5">
                  {Object.entries(counts)
                    .filter(([, v]) => v > 0)
                    .map(([r, v]) => (
                      <span
                        key={r}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${REC_STYLES[r as Recommendation]}`}
                      >
                        {v} {r}
                      </span>
                    ))}
                </div>
              </button>

              {isExpanded &&
                category.services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 pl-10"
                  >
                    <div
                      className={`w-2 h-2 rounded-sm flex-shrink-0 ${
                        service.rec === 'BUILD'
                          ? 'bg-emerald-500'
                          : service.rec === 'HYBRID'
                            ? 'bg-blue-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700">{service.name}</div>
                      <div className="text-[10px] text-gray-400">{service.desc}</div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${REC_STYLES[service.rec]}`}
                    >
                      {service.rec}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${POC_STYLES[String(service.poc)]}`}
                    >
                      {POC_LABELS[String(service.poc)]}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
