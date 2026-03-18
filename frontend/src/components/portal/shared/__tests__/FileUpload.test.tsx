import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUpload from '../FileUpload';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createFile(name: string, sizeMb: number, type = 'application/pdf'): File {
  const bytes = new Uint8Array(sizeMb * 1024 * 1024);
  return new File([bytes], name, { type });
}

function setFileInput(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], writable: false });
  fireEvent.change(input);
}

function dropFile(dropZone: HTMLElement, file: File) {
  const dataTransfer = { files: [file], types: ['Files'] };
  fireEvent.dragOver(dropZone, { dataTransfer });
  fireEvent.drop(dropZone, { dataTransfer });
}

const defaultProps = {
  id: 'test-doc',
  label: 'Upload a document',
  onFileSelected: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FileUpload', () => {
  it('renders drop zone with accepted formats and max size', () => {
    render(<FileUpload {...defaultProps} acceptedFormats={['pdf', 'jpg']} maxSizeMb={10} />);

    expect(screen.getByTestId('drop-zone-test-doc')).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG/)).toBeInTheDocument();
    expect(screen.getByText(/Max 10MB/)).toBeInTheDocument();
  });

  it('click on drop zone triggers hidden file input', () => {
    render(<FileUpload {...defaultProps} />);

    const input = screen.getByTestId('file-input-test-doc') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByTestId('drop-zone-test-doc'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('rejects file with invalid extension', () => {
    const onFileSelected = vi.fn();
    render(
      <FileUpload {...defaultProps} onFileSelected={onFileSelected} acceptedFormats={['pdf']} />,
    );

    const input = screen.getByTestId('file-input-test-doc') as HTMLInputElement;
    setFileInput(input, createFile('photo.exe', 1));

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-error-test-doc')).toHaveTextContent('Invalid format');
  });

  it('rejects file exceeding max size', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload {...defaultProps} onFileSelected={onFileSelected} maxSizeMb={5} />);

    const input = screen.getByTestId('file-input-test-doc') as HTMLInputElement;
    setFileInput(input, createFile('big.pdf', 6));

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-error-test-doc')).toHaveTextContent('File too large');
  });

  it('calls onFileSelected for valid file via input change', () => {
    const onFileSelected = vi.fn();
    render(
      <FileUpload
        {...defaultProps}
        onFileSelected={onFileSelected}
        acceptedFormats={['pdf']}
        maxSizeMb={10}
      />,
    );

    const input = screen.getByTestId('file-input-test-doc') as HTMLInputElement;
    const file = createFile('report.pdf', 2);
    setFileInput(input, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('shows progress bar when status=uploading with progress value', () => {
    render(<FileUpload {...defaultProps} status="uploading" progress={45} />);

    const progressBar = screen.getByTestId('upload-progress-test-doc');
    expect(progressBar).toBeInTheDocument();
    // The inner bar should have width 45%
    const inner = progressBar.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('45%');
  });

  it('shows uploaded state with filename when status=uploaded', () => {
    render(<FileUpload {...defaultProps} status="uploaded" filename="report.pdf" />);

    expect(screen.getByTestId('uploaded-test-doc')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    // Drop zone should not be present in uploaded state
    expect(screen.queryByTestId('drop-zone-test-doc')).not.toBeInTheDocument();
  });

  it('shows external error message from errorMessage prop', () => {
    render(<FileUpload {...defaultProps} errorMessage="Server rejected the file" />);

    expect(screen.getByTestId('upload-error-test-doc')).toHaveTextContent(
      'Server rejected the file',
    );
  });

  it('drag-and-drop valid file triggers onFileSelected', () => {
    const onFileSelected = vi.fn();
    render(
      <FileUpload {...defaultProps} onFileSelected={onFileSelected} acceptedFormats={['pdf']} />,
    );

    const dropZone = screen.getByTestId('drop-zone-test-doc');
    const file = createFile('scan.pdf', 1);
    dropFile(dropZone, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('compact mode renders button instead of drop zone', () => {
    render(<FileUpload {...defaultProps} compact />);

    expect(screen.queryByTestId('drop-zone-test-doc')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-btn-test-doc')).toBeInTheDocument();
    expect(screen.getByText(/Choose file for Upload a document/)).toBeInTheDocument();
  });

  it('compact mode shows progress bar when uploading', () => {
    render(<FileUpload {...defaultProps} compact status="uploading" progress={70} />);

    expect(screen.getByTestId('upload-btn-test-doc')).toBeDisabled();
    const progressBar = screen.getByTestId('upload-progress-test-doc');
    const inner = progressBar.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe('70%');
  });
});
