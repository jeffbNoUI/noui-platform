import { useRef, useState } from 'react';
import { C, BODY } from '@/lib/designSystem';

interface DocumentUploaderProps {
  documentType: string;
  label: string;
  acceptedFormats: string[];
  maxSizeMb?: number;
  onUpload: (file: File) => void;
  status?: 'idle' | 'uploading' | 'uploaded' | 'error';
  filename?: string;
}

const FORMAT_ACCEPT: Record<string, string> = {
  pdf: '.pdf',
  jpg: '.jpg,.jpeg',
  png: '.png',
};

export default function DocumentUploader({
  documentType,
  label,
  acceptedFormats,
  maxSizeMb = 10,
  onUpload,
  status = 'idle',
  filename,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptStr = acceptedFormats.map((f) => FORMAT_ACCEPT[f] || `.${f}`).join(',');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate size
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxSizeMb}MB.`);
      return;
    }

    // Validate format
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = acceptedFormats.flatMap((f) => (f === 'jpg' ? ['jpg', 'jpeg'] : [f]));
    if (!ext || !validExts.includes(ext)) {
      setError(`Invalid format. Accepted: ${acceptedFormats.join(', ').toUpperCase()}`);
      return;
    }

    onUpload(file);
  }

  return (
    <div data-testid={`uploader-${documentType}`}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptStr}
        onChange={handleFile}
        style={{ display: 'none' }}
        data-testid={`file-input-${documentType}`}
      />

      {status === 'uploaded' && filename ? (
        <div
          data-testid={`uploaded-${documentType}`}
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
          <span style={{ fontWeight: 600 }}>Uploaded:</span> {filename}
        </div>
      ) : (
        <button
          data-testid={`upload-btn-${documentType}`}
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
      )}

      {error && (
        <div
          data-testid={`error-${documentType}`}
          style={{
            fontFamily: BODY,
            fontSize: 12,
            color: C.coral,
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          fontFamily: BODY,
          fontSize: 11,
          color: C.textTertiary,
          marginTop: 4,
        }}
      >
        {acceptedFormats.join(', ').toUpperCase()} &middot; Max {maxSizeMb}MB
      </div>
    </div>
  );
}
