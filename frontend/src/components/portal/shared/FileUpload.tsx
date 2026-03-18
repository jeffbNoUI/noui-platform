import { useRef, useState, useCallback } from 'react';
import { C, BODY } from '@/lib/designSystem';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FORMATS = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'heic', 'doc', 'docx', 'xls', 'xlsx'];

const DEFAULT_MAX_SIZE_MB = 25;

const FORMAT_ACCEPT: Record<string, string> = {
  pdf: '.pdf',
  jpg: '.jpg,.jpeg',
  jpeg: '.jpeg',
  png: '.png',
  tiff: '.tiff,.tif',
  heic: '.heic',
  doc: '.doc',
  docx: '.docx',
  xls: '.xls',
  xlsx: '.xlsx',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface FileUploadProps {
  /** Unique ID for testability */
  id: string;
  /** Label shown in the drop zone / button */
  label: string;
  /** Accepted file extensions without dot, e.g. ['pdf', 'jpg'] */
  acceptedFormats?: string[];
  /** Max file size in MB (default 25) */
  maxSizeMb?: number;
  /** Called when a valid file is selected */
  onFileSelected: (file: File) => void;
  /** Upload progress 0–100, shown when status='uploading' */
  progress?: number;
  /** Current state */
  status?: 'idle' | 'uploading' | 'uploaded' | 'error';
  /** Filename shown in the uploaded state */
  filename?: string;
  /** Error message from parent (e.g. server rejection) */
  errorMessage?: string;
  /** Compact mode — button only, no drag zone */
  compact?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FileUpload({
  id,
  label,
  acceptedFormats = DEFAULT_FORMATS,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  onFileSelected,
  progress,
  status = 'idle',
  filename,
  errorMessage,
  compact = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const acceptStr = acceptedFormats.map((f) => FORMAT_ACCEPT[f] || `.${f}`).join(',');

  // Normalize accepted extensions for comparison
  const validExts = acceptedFormats.flatMap((f) =>
    f === 'jpg' ? ['jpg', 'jpeg'] : f === 'tiff' ? ['tiff', 'tif'] : [f],
  );

  const validateAndSelect = useCallback(
    (file: File) => {
      setValidationError(null);

      // Extension check
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !validExts.includes(ext)) {
        setValidationError(
          `Invalid format. Accepted: ${acceptedFormats.map((f) => f.toUpperCase()).join(', ')}`,
        );
        return;
      }

      // Size check
      if (file.size > maxSizeMb * 1024 * 1024) {
        setValidationError(`File too large. Maximum size is ${maxSizeMb}MB.`);
        return;
      }

      onFileSelected(file);
    },
    [validExts, acceptedFormats, maxSizeMb, onFileSelected],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const displayError = validationError || errorMessage;

  // ── Hidden file input (shared by all modes) ────────────────────────────

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={acceptStr}
      onChange={handleInputChange}
      style={{ display: 'none' }}
      data-testid={`file-input-${id}`}
    />
  );

  // ── Uploaded state ─────────────────────────────────────────────────────

  if (status === 'uploaded' && filename) {
    return (
      <div data-testid={`file-upload-${id}`}>
        <div
          data-testid={`uploaded-${id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: C.sageLight,
            borderRadius: 6,
            fontFamily: BODY,
            fontSize: 13,
            color: C.sage,
          }}
        >
          <span style={{ fontSize: 16 }}>&#10003;</span>
          <span>
            <span style={{ fontWeight: 600 }}>Uploaded:</span> {filename}
          </span>
        </div>
      </div>
    );
  }

  // ── Compact mode (button only) ─────────────────────────────────────────

  if (compact) {
    return (
      <div data-testid={`file-upload-${id}`}>
        {fileInput}
        <button
          data-testid={`upload-btn-${id}`}
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading'}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px dashed ${C.border}`,
            background: C.cardBg,
            color: status === 'uploading' ? C.textTertiary : C.navy,
            cursor: status === 'uploading' ? 'default' : 'pointer',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {status === 'uploading' ? 'Uploading...' : `Choose file for ${label}`}
        </button>

        {/* Progress bar in compact mode */}
        {status === 'uploading' && progress != null && (
          <div
            data-testid={`upload-progress-${id}`}
            style={{
              marginTop: 6,
              height: 4,
              background: C.borderLight,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(progress, 100)}%`,
                height: '100%',
                background: C.sage,
                borderRadius: 2,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        )}

        {displayError && (
          <div
            data-testid={`upload-error-${id}`}
            style={{ fontFamily: BODY, fontSize: 12, color: C.coral, marginTop: 4 }}
          >
            {displayError}
          </div>
        )}

        <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
          {acceptedFormats.map((f) => f.toUpperCase()).join(', ')} &middot; Max {maxSizeMb}MB
        </div>
      </div>
    );
  }

  // ── Full mode (drag-and-drop zone) ─────────────────────────────────────

  return (
    <div data-testid={`file-upload-${id}`}>
      {fileInput}

      <div
        data-testid={`drop-zone-${id}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? C.sage : C.border}`,
          borderRadius: 10,
          padding: '28px 20px',
          textAlign: 'center',
          cursor: status === 'uploading' ? 'default' : 'pointer',
          background: dragOver ? C.sageLight : C.cardBg,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.navy,
            marginBottom: 4,
          }}
        >
          {status === 'uploading' ? 'Uploading...' : `Drag & drop or click to upload`}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{label}</div>
        <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary, marginTop: 8 }}>
          {acceptedFormats.map((f) => f.toUpperCase()).join(', ')} &middot; Max {maxSizeMb}MB
        </div>
      </div>

      {/* Progress bar */}
      {status === 'uploading' && progress != null && (
        <div
          data-testid={`upload-progress-${id}`}
          style={{
            marginTop: 8,
            height: 6,
            background: C.borderLight,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(progress, 100)}%`,
              height: '100%',
              background: C.sage,
              borderRadius: 3,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}

      {displayError && (
        <div
          data-testid={`upload-error-${id}`}
          style={{ fontFamily: BODY, fontSize: 12, color: C.coral, marginTop: 6 }}
        >
          {displayError}
        </div>
      )}
    </div>
  );
}
