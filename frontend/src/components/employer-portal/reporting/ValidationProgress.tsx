import { C, BODY } from '@/lib/designSystem';
import type { ContributionFile, FileStatus } from '@/types/Employer';

interface ValidationProgressProps {
  file: ContributionFile;
}

interface StepDef {
  key: FileStatus | FileStatus[];
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'UPLOADED', label: 'Uploaded' },
  { key: 'VALIDATING', label: 'Validating' },
  { key: ['VALIDATED', 'PARTIAL_POST', 'EXCEPTION'], label: 'Validated' },
  { key: 'PAYMENT_SETUP', label: 'Payment Setup' },
  { key: 'PROCESSED', label: 'Processed' },
];

function getStepIndex(status: FileStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    if (Array.isArray(step.key)) {
      if (step.key.includes(status)) return i;
    } else if (step.key === status) {
      return i;
    }
  }
  return 0;
}

function getStatusColor(status: FileStatus): string {
  switch (status) {
    case 'VALIDATED':
    case 'PROCESSED':
      return C.sage;
    case 'EXCEPTION':
    case 'REJECTED':
      return C.coral;
    case 'VALIDATING':
    case 'PARTIAL_POST':
    case 'PAYMENT_PENDING':
      return C.gold;
    default:
      return C.sky;
  }
}

export default function ValidationProgress({ file }: ValidationProgressProps) {
  const currentStep = getStepIndex(file.fileStatus);
  const statusColor = getStatusColor(file.fileStatus);
  const isTerminal = file.fileStatus === 'REJECTED' || file.fileStatus === 'REPLACED';

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Status header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>{file.fileName}</span>
        <span
          style={{
            display: 'inline-block',
            background: `${statusColor}18`,
            color: statusColor,
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 10px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {file.fileStatus.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Stepper */}
      {!isTerminal && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {STEPS.map((_step, i) => {
            const isComplete = i < currentStep;
            const isCurrent = i === currentStep;
            const dotColor = isComplete ? C.sage : isCurrent ? statusColor : C.borderLight;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: i < STEPS.length - 1 ? 1 : undefined,
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: isCurrent ? 14 : 10,
                    height: isCurrent ? 14 : 10,
                    borderRadius: '50%',
                    background: dotColor,
                    border: isCurrent ? `2px solid ${statusColor}` : 'none',
                    flexShrink: 0,
                  }}
                />
                {/* Line */}
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: isComplete ? C.sage : C.borderLight,
                      margin: '0 4px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step labels */}
      {!isTerminal && (
        <div style={{ display: 'flex', marginBottom: 24 }}>
          {STEPS.map((s, i) => {
            const isCurrent = i === currentStep;
            return (
              <div
                key={i}
                style={{
                  flex: i < STEPS.length - 1 ? 1 : undefined,
                  fontSize: 11,
                  color: isCurrent ? C.navy : C.textTertiary,
                  fontWeight: isCurrent ? 600 : 400,
                  textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center',
                }}
              >
                {s.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Record counts */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          display: 'flex',
          gap: 32,
        }}
      >
        <CountBlock label="Total Records" value={file.totalRecords} color={C.navy} />
        <CountBlock label="Valid" value={file.validRecords} color={C.sage} />
        <CountBlock label="Failed" value={file.failedRecords} color={C.coral} />
      </div>

      {/* Progress bar */}
      {file.totalRecords > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: C.borderLight,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {file.validRecords > 0 && (
              <div
                style={{
                  width: `${(file.validRecords / file.totalRecords) * 100}%`,
                  background: C.sage,
                  height: '100%',
                }}
              />
            )}
            {file.failedRecords > 0 && (
              <div
                style={{
                  width: `${(file.failedRecords / file.totalRecords) * 100}%`,
                  background: C.coral,
                  height: '100%',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: C.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
