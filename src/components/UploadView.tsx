import { useState, useRef, useCallback } from 'react';
import { DELIMITER_PRESETS } from '../types';
import type { DelimiterPair } from '../types';
import { extractText, extractPlaceholders } from '../lib/parser';

interface Props {
  onParsed: (
    rawText: string,
    fileName: string,
    fileData: ArrayBuffer,
    fileType: string,
    delimiter: DelimiterPair,
    placeholders: string[]
  ) => void;
}

export default function UploadView({ onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [delimiter, setDelimiter] = useState<DelimiterPair>(DELIMITER_PRESETS[0]);
  const [customOpen, setCustomOpen] = useState('');
  const [customClose, setCustomClose] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const activeDelim = customOpen && customClose
    ? { open: customOpen, close: customClose, label: 'custom' }
    : delimiter;

  const placeholders = rawText ? extractPlaceholders(rawText, activeDelim) : [];

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setError('');
    try {
      const text = await extractText(f);
      setRawText(text);
    } catch (e: any) {
      setError(e.message || 'Failed to read file');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleParse = async () => {
    if (!file || placeholders.length === 0) return;
    const ab = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    onParsed(rawText, file.name, ab, ext, activeDelim, placeholders);
  };

  return (
    <div className="upload-view">
      <div className="upload-hero">
        <h1>Doc Drafter</h1>
        <p className="tagline">
          Open-source document template filler. Upload a contract, fill a form, generate the document — without breaking the formatting.
        </p>
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
            <p>{(file.size / 1024).toFixed(1)} KB — {rawText.length.toLocaleString()} characters extracted</p>
          </>
        ) : (
          <>
            <div className="file-icon">+</div>
            <h2>Drop your template here</h2>
            <p>DOCX, PDF, TXT, or any text file with placeholders</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf,.txt,.md,.html,.rtf"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && <div className="error-msg">{error}</div>}

      {file && rawText && (
        <div className="delimiter-picker">
          <h3>What are your placeholders wrapped in?</h3>
          <div className="delim-row">
            {DELIMITER_PRESETS.map((d) => (
              <button
                key={d.label}
                className={`delim-btn ${delimiter === d && !customOpen ? 'active' : ''}`}
                onClick={() => {
                  setDelimiter(d);
                  setCustomOpen('');
                  setCustomClose('');
                }}
              >
                {d.label}
              </button>
            ))}
            <div className="custom-delim">
              <span>custom:</span>
              <input
                value={customOpen}
                onChange={(e) => setCustomOpen(e.target.value)}
                placeholder="<<"
                maxLength={4}
              />
              <span>...</span>
              <input
                value={customClose}
                onChange={(e) => setCustomClose(e.target.value)}
                placeholder=">>"
                maxLength={4}
              />
            </div>
          </div>

          <div className="placeholder-preview">
            {placeholders.length > 0 ? (
              <span className="found">
                Found {placeholders.length} placeholder{placeholders.length !== 1 ? 's' : ''}:{' '}
                {placeholders.slice(0, 6).join(', ')}
                {placeholders.length > 6 ? '...' : ''}
              </span>
            ) : (
              <span className="not-found">No placeholders found with these delimiters</span>
            )}
          </div>

          <button
            className="parse-btn"
            disabled={placeholders.length === 0}
            onClick={handleParse}
          >
            Continue — Fill Template
          </button>
        </div>
      )}
    </div>
  );
}
