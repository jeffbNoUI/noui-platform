import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useContributionFiles, useDeleteFile } from '@/hooks/useEmployerReporting';
import type { FileStatus } from '@/types/Employer';

interface FileUploadProps {
  orgId: string;
  divisionCode: string;
}

const STATUS_COLORS: Record<FileStatus, { bg: string; text: string }> = {
  UPLOADED: { bg: C.skyLight, text: C.sky },
  VALIDATING: { bg: C.goldLight, text: C.gold },
  VALIDATED: { bg: C.sageLight, text: C.sage },
  PARTIAL_POST: { bg: C.goldLight, text: C.gold },
  EXCEPTION: { bg: C.coralLight, text: C.coral },
  PAYMENT_SETUP: { bg: C.skyLight, text: C.sky },
  PAYMENT_PENDING: { bg: C.goldLight, text: C.gold },
  PROCESSED: { bg: C.sageLight, text: C.sageDark },
  REPLACED: { bg: '#F0EEEA', text: C.textTertiary },
  REJECTED: { bg: C.coralLight, text: C.coral },
};

export default function FileUpload({ orgId, divisionCode }: FileUploadProps) {
  const { data: filesResult, isLoading } = useContributionFiles(orgId);
  const files = filesResult?.items;
  const deleteFile = useDeleteFile();
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // TODO: implement file upload handler
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteFile.mutateAsync(fileId);
    } catch {
      // Error handled by React Query
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Drag-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: dragOver ? C.sageLight : C.cardBgWarm,
          border: `2px dashed ${dragOver ? C.sage : C.border}`,
          borderRadius: 8,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u2B06'}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Drag and drop contribution file here
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary }}>
          Supports .txt and .xlsx formats for division {divisionCode}
        </div>
      </div>

      {/* Recent files */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 12px' }}>
          Recent Files
        </h3>

        {isLoading && <div style={{ color: C.textSecondary, padding: 24 }}>Loading...</div>}

        {!isLoading && (!files || files.length === 0) && (
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
            No files found
          </div>
        )}

        {files && files.length > 0 && (
          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>File Name</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Period</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Records</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Valid</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Failed</th>
                  <th style={{ ...thStyle, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const statusColor = STATUS_COLORS[file.fileStatus] ?? {
                    bg: '#F0EEEA',
                    text: C.textTertiary,
                  };
                  return (
                    <tr key={file.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 500, color: C.text }}>{file.fileName}</span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            background: statusColor.bg,
                            color: statusColor.text,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {file.fileStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: C.textSecondary }}>
                        {file.periodStart} - {file.periodEnd}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: C.text }}>
                        {file.totalRecords}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: C.sage }}>
                        {file.validRecords}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: C.coral }}>
                        {file.failedRecords}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {file.fileStatus === 'UPLOADED' && (
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={deleteFile.isPending}
                            style={{
                              background: 'none',
                              border: `1px solid ${C.coral}`,
                              color: C.coral,
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '4px 10px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontFamily: BODY,
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 12,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: C.text,
};
