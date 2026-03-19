import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useContributionFiles, useSubmitCorrection } from '@/hooks/useEmployerReporting';
import type { ContributionFile } from '@/types/Employer';

interface CorrectionWorkflowProps {
  orgId: string;
  divisionCode: string;
}

export default function CorrectionWorkflow({ orgId, divisionCode }: CorrectionWorkflowProps) {
  const { data: filesResult, isLoading } = useContributionFiles(orgId);
  const files = filesResult?.items;
  const correctionMutation = useSubmitCorrection();

  const [selectedFileId, setSelectedFileId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only show files that can be corrected (VALIDATED, PARTIAL_POST, EXCEPTION, PROCESSED)
  const correctableFiles = (files ?? []).filter((f: ContributionFile) =>
    ['VALIDATED', 'PARTIAL_POST', 'EXCEPTION', 'PROCESSED'].includes(f.fileStatus),
  );

  const selectedFile = correctableFiles.find((f: ContributionFile) => f.id === selectedFileId);

  const handleSubmit = async () => {
    if (!selectedFileId || !periodStart || !periodEnd) return;
    setSubmitError(null);
    try {
      await correctionMutation.mutateAsync({
        orgId,
        originalFileId: selectedFileId,
        periodStart,
        periodEnd,
        divisionCode,
      });
      setSelectedFileId('');
      setPeriodStart('');
      setPeriodEnd('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Correction submission failed');
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 16px' }}>
        Submit Correction
      </h3>

      {isLoading && <div style={{ color: C.textSecondary, padding: 24 }}>Loading...</div>}

      {!isLoading && correctableFiles.length === 0 && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '32px 24px',
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 14,
          }}
        >
          No files available for correction
        </div>
      )}

      {!isLoading && correctableFiles.length > 0 && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          {/* File selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Select File to Correct</label>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              style={selectStyle}
            >
              <option value="">-- Select a file --</option>
              {correctableFiles.map((f: ContributionFile) => (
                <option key={f.id} value={f.id}>
                  {f.fileName} ({f.periodStart} - {f.periodEnd}) [{f.fileStatus}]
                </option>
              ))}
            </select>
          </div>

          {/* Selected file details */}
          {selectedFile && (
            <div
              style={{
                background: C.cardBgWarm,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 6,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
                Original File Details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px 24px',
                  fontSize: 13,
                }}
              >
                <DetailRow label="File Name" value={selectedFile.fileName} />
                <DetailRow label="Status" value={selectedFile.fileStatus.replace(/_/g, ' ')} />
                <DetailRow
                  label="Period"
                  value={`${selectedFile.periodStart} - ${selectedFile.periodEnd}`}
                />
                <DetailRow label="Division" value={selectedFile.divisionCode} />
                <DetailRow label="Total Records" value={String(selectedFile.totalRecords)} />
                <DetailRow
                  label="Total Amount"
                  value={`$${Number(selectedFile.totalAmount).toLocaleString()}`}
                />
                <DetailRow label="Valid Records" value={String(selectedFile.validRecords)} />
                <DetailRow label="Failed Records" value={String(selectedFile.failedRecords)} />
              </div>
            </div>
          )}

          {/* Correction period */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Correction Period Start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Correction Period End</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleSubmit}
              disabled={
                correctionMutation.isPending || !selectedFileId || !periodStart || !periodEnd
              }
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                padding: '8px 20px',
                background: C.navy,
                color: C.textOnDark,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                opacity:
                  correctionMutation.isPending || !selectedFileId || !periodStart || !periodEnd
                    ? 0.5
                    : 1,
              }}
            >
              {correctionMutation.isPending ? 'Submitting...' : 'Submit Correction'}
            </button>
            {submitError && <span style={{ color: C.coral, fontSize: 13 }}>{submitError}</span>}
            {correctionMutation.isSuccess && (
              <span style={{ color: C.sage, fontSize: 13 }}>Correction submitted</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: C.textSecondary, fontSize: 12 }}>{label}: </span>
      <span style={{ color: C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: C.textSecondary,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '6px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  color: C.text,
};

const selectStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 14,
  padding: '6px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  color: C.text,
  width: '100%',
  background: C.cardBg,
};
