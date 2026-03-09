import { useState } from 'react';
import { Callout } from '../shared';
import type { Member } from '../../../types/Member';

interface DocItem {
  id: string;
  label: string;
  required: boolean;
  status: 'received' | 'pending' | 'missing';
  conditional?: boolean;
}

function buildChecklist(flags: { hasDRO: boolean; maritalStatus?: string }): DocItem[] {
  const docs: DocItem[] = [
    {
      id: 'retirement-app',
      label: 'Signed Retirement Application',
      required: true,
      status: 'received',
    },
    {
      id: 'id-verification',
      label: 'Government-Issued Photo ID',
      required: true,
      status: 'received',
    },
    {
      id: 'birth-cert',
      label: 'Birth Certificate or Proof of Age',
      required: true,
      status: 'pending',
    },
    {
      id: 'employment-ver',
      label: 'Employment Verification Letter',
      required: true,
      status: 'received',
    },
    { id: 'salary-cert', label: 'Final Salary Certification', required: true, status: 'received' },
    {
      id: 'direct-deposit',
      label: 'Direct Deposit Authorization',
      required: false,
      status: 'pending',
    },
    {
      id: 'tax-withholding',
      label: 'Federal/State Tax Withholding (W-4P)',
      required: true,
      status: 'pending',
    },
  ];

  if (flags.maritalStatus === 'M') {
    docs.push(
      {
        id: 'marriage-cert',
        label: 'Marriage Certificate',
        required: true,
        status: 'received',
        conditional: true,
      },
      {
        id: 'spouse-consent',
        label: 'Spousal Consent Form',
        required: true,
        status: 'pending',
        conditional: true,
      },
    );
  }

  if (flags.hasDRO) {
    docs.push(
      {
        id: 'dro-order',
        label: 'Certified DRO Court Order',
        required: true,
        status: 'received',
        conditional: true,
      },
      {
        id: 'dro-qdro',
        label: 'QDRO Approval Letter',
        required: true,
        status: 'pending',
        conditional: true,
      },
    );
  }

  return docs;
}

const STATUS_STYLES = {
  received: { label: 'Received', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  missing: { label: 'Missing', className: 'bg-red-50 text-red-700 border-red-200' },
};

export default function IntakeStage({
  flags,
}: {
  member?: Member;
  flags: { hasDRO: boolean; maritalStatus?: string };
}) {
  const [docs, setDocs] = useState<DocItem[]>(() => buildChecklist(flags));

  const toggleStatus = (id: string) => {
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const next =
          d.status === 'received' ? 'pending' : d.status === 'pending' ? 'missing' : 'received';
        return { ...d, status: next };
      }),
    );
  };

  const received = docs.filter((d) => d.status === 'received').length;
  const total = docs.length;
  const allReceived = received === total;

  return (
    <div>
      {/* Progress summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-700 font-medium">Document Checklist</div>
        <div className="flex items-center gap-2">
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-iw-sage rounded-full transition-all duration-300"
              style={{ width: `${(received / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {received}/{total}
          </span>
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-1">
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => toggleStatus(doc.id)}
            className={`flex items-center justify-between py-2.5 px-3 rounded-lg border cursor-pointer transition-colors ${
              doc.status === 'received'
                ? 'border-emerald-100 bg-emerald-50/30'
                : doc.status === 'missing'
                  ? 'border-red-100 bg-red-50/30'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm">
                {doc.status === 'received' ? '✓' : doc.status === 'missing' ? '✕' : '○'}
              </span>
              <div>
                <span className="text-sm text-gray-700">{doc.label}</span>
                {doc.conditional && (
                  <span className="ml-2 text-[10px] text-gray-400 italic">conditional</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {doc.required && (
                <span className="text-[9px] text-red-400 uppercase font-semibold">Required</span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[doc.status].className}`}
              >
                {STATUS_STYLES[doc.status].label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {allReceived && (
        <Callout
          type="success"
          text="All required documents have been received. Proceed to employment verification."
        />
      )}

      {!allReceived && docs.some((d) => d.status === 'missing' && d.required) && (
        <Callout
          type="danger"
          title="Missing Required Documents"
          text="One or more required documents are marked as missing. These must be obtained before certification."
        />
      )}
    </div>
  );
}
