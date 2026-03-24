import { useState, useRef, useCallback } from 'react';
import { DELIMITER_PRESETS } from '../types';
import type { DelimiterPair } from '../types';
import { parseTemplate } from '../lib/api';

interface Props {
  onParsed: (
    rawText: string,
    fileName: string,
    file: File,
    fileType: string,
    delimiter: DelimiterPair,
    placeholders: string[],
    schema: any
  ) => void;
}

export default function UploadView({ onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState<DelimiterPair>(DELIMITER_PRESETS[0]);
  const [customOpen, setCustomOpen] = useState('');
  const [customClose, setCustomClose] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ placeholders: string[]; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeDelim = customOpen && customClose
    ? { open: customOpen, close: customClose, label: 'custom' }
    : delimiter;

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError('');
    setPreviewResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const result = await parseTemplate(file, activeDelim.open, activeDelim.close);
      setPreviewResult({ placeholders: result.placeholders, text: result.text });
    } catch (e: any) {
      setError(e.message || 'Failed to parse');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!file || !previewResult) return;
    setLoading(true);
    setError('');
    try {
      const result = await parseTemplate(file, activeDelim.open, activeDelim.close);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      onParsed(result.text, result.filename, file, ext, activeDelim, result.placeholders, result.schema);
    } catch (e: any) {
      setError(e.message || 'Failed to parse');
    } finally {
      setLoading(false);
    }
  };

  // Re-preview when delimiter changes
  const handleDelimChange = (d: DelimiterPair) => {
    setDelimiter(d);
    setCustomOpen('');
    setCustomClose('');
    setPreviewResult(null);
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
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <>
            <div className="file-icon">📄</div>
            <h2>{file.name}</h2>
            <p>{(file.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <div className="file-icon">+</div>
            <h2>Drop your template here</h2>
            <p>DOCX, PDF (text or scanned), images, TXT, or any text file</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf,.txt,.md,.html,.rtf,.png,.jpg,.jpeg,.tiff,.bmp"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && <div className="error-msg">{error}</div>}

      {file && (
        <div className="delimiter-picker">
          <h3>What are your placeholders wrapped in?</h3>
          <div className="delim-row">
            {DELIMITER_PRESETS.map((d) => (
              <button
                key={d.label}
                className={`delim-btn ${delimiter === d && !customOpen ? 'active' : ''}`}
                onClick={() => handleDelimChange(d)}
              >
                {d.label}
              </button>
            ))}
            <div className="custom-delim">
              <span>custom:</span>
              <input
                value={customOpen}
                onChange={(e) => { setCustomOpen(e.target.value); setPreviewResult(null); }}
                placeholder="<<"
                maxLength={4}
              />
              <span>...</span>
              <input
                value={customClose}
                onChange={(e) => { setCustomClose(e.target.value); setPreviewResult(null); }}
                placeholder=">>"
                maxLength={4}
              />
            </div>
          </div>

          {!previewResult && (
            <button
              className="parse-btn"
              disabled={loading}
              onClick={handlePreview}
            >
              {loading ? 'Parsing...' : 'Scan for Placeholders'}
            </button>
          )}

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
                    {loading ? 'Loading...' : 'Continue — Fill Template'}
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
      )}
    </div>
  );
}
