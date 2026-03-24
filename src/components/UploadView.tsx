import { useState, useRef, useCallback, useEffect } from 'react';
import { DELIMITER_PRESETS } from '../types';
import type { DelimiterPair, JSONSchema } from '../types';
import { parseTemplate } from '../lib/api';

interface ParsedResult {
  rawText: string;
  fileName: string;
  file: File;
  fileType: string;
  delimiter: DelimiterPair;
  placeholders: string[];
  schema: JSONSchema | null;
}

interface Props {
  onParsed: (result: ParsedResult) => void;
}

export default function UploadView({ onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState<DelimiterPair>(DELIMITER_PRESETS[0]);
  const [customOpen, setCustomOpen] = useState('');
  const [customClose, setCustomClose] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    placeholders: string[];
    text: string;
    filename: string;
    schema: JSONSchema | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const delimRef = useRef<HTMLHeadingElement>(null);

  const activeDelim = customOpen && customClose
    ? { open: customOpen, close: customClose, label: 'custom' }
    : delimiter;

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError('');
    setPreviewResult(null);
  }, []);

  useEffect(() => {
    if (file && delimRef.current) delimRef.current.focus();
  }, [file]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const allowed = ['docx','pdf','txt','md','html','rtf','png','jpg','jpeg','tiff','bmp'];
      if (!allowed.includes(ext)) {
        setError(`Unsupported file type: .${ext}`);
        return;
      }
      handleFile(f);
    },
    [handleFile]
  );

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const result = await parseTemplate(file, activeDelim.open, activeDelim.close);
      setPreviewResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!file || !previewResult) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    onParsed({
      rawText: previewResult.text,
      fileName: previewResult.filename,
      file,
      fileType: ext,
      delimiter: activeDelim,
      placeholders: previewResult.placeholders,
      schema: previewResult.schema,
    });
  };

  const handleDelimChange = (d: DelimiterPair) => {
    setDelimiter(d);
    setCustomOpen('');
    setCustomClose('');
    setPreviewResult(null);
  };

  const handleDropZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileRef.current?.click();
    }
  };

  return (
    <div className="upload-view">
      <div className="upload-hero">
        <h1>Doc Drafter</h1>
        <p className="tagline">
          Open-source document template filler. Upload a contract, fill a form, generate the document — without breaking the formatting.
        </p>
        <p className="tagline sub">Supports scanned PDFs with OCR, DOCX, images, and plain text files.</p>
      </div>

      <div
        className={`drop-zone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={file ? `Selected file: ${file.name}. Click to change file.` : 'Upload a template file. Accepts DOCX, PDF, images, and text files.'}
        onClick={() => fileRef.current?.click()}
        onKeyDown={handleDropZoneKeyDown}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <>
            <div className="file-icon" aria-hidden="true">&#x1F4C4;</div>
            <h2>{file.name}</h2>
            <p>{(file.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <div className="file-icon" aria-hidden="true">+</div>
            <h2>Drop your template here</h2>
            <p>DOCX, PDF (text or scanned), images, TXT, or any text file</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          aria-label="Upload template file"
          accept=".docx,.pdf,.txt,.md,.html,.rtf,.png,.jpg,.jpeg,.tiff,.bmp"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && <div className="error-msg" role="alert">{error}</div>}

      {file && (
        <div className="delimiter-picker">
          <h2 ref={delimRef} tabIndex={-1}>What are your placeholders wrapped in?</h2>
          <div className="delim-row" role="group" aria-label="Delimiter presets">
            {DELIMITER_PRESETS.map((d) => (
              <button
                key={d.label}
                className={`delim-btn ${delimiter === d && !customOpen ? 'active' : ''}`}
                aria-pressed={delimiter === d && !customOpen}
                onClick={() => handleDelimChange(d)}
              >
                {d.label}
              </button>
            ))}
            <div className="custom-delim">
              <span aria-hidden="true">custom:</span>
              <input
                value={customOpen}
                onChange={(e) => { setCustomOpen(e.target.value); setPreviewResult(null); }}
                placeholder="<<"
                maxLength={4}
                aria-label="Custom opening delimiter"
              />
              <span aria-hidden="true">...</span>
              <input
                value={customClose}
                onChange={(e) => { setCustomClose(e.target.value); setPreviewResult(null); }}
                placeholder=">>"
                maxLength={4}
                aria-label="Custom closing delimiter"
              />
            </div>
          </div>

          {!previewResult && (
            <button
              className="parse-btn"
              disabled={loading}
              aria-busy={loading}
              onClick={handlePreview}
            >
              {loading ? 'Parsing...' : 'Scan for Placeholders'}
            </button>
          )}

          <div role="status" aria-live="polite">
            {previewResult && (
              <div className="placeholder-preview">
                {previewResult.placeholders.length > 0 ? (
                  <>
                    <span className="found">
                      Found {previewResult.placeholders.length} placeholder{previewResult.placeholders.length !== 1 ? 's' : ''}:{' '}
                      {previewResult.placeholders.slice(0, 6).join(', ')}
                      {previewResult.placeholders.length > 6 ? '...' : ''}
                    </span>
                    <button
                      className="parse-btn"
                      disabled={loading}
                      onClick={handleContinue}
                    >
                      Continue — Fill Template
                    </button>
                  </>
                ) : (
                  <span className="not-found">
                    No placeholders found with these delimiters. Text extracted ({previewResult.text.length.toLocaleString()} chars) — try different delimiters.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
