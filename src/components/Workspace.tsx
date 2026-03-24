import { useState, useMemo, useCallback, useRef } from 'react';
import { saveAs } from 'file-saver';
import type { DelimiterPair, JSONSchema } from '../types';
import { buildSchema } from '../lib/parser';
import { generateDocument } from '../lib/api';
import SchemaForm from './SchemaForm';
import DocPreview from './DocPreview';

interface Props {
  rawText: string;
  fileName: string;
  file: File;
  fileType: string;
  delimiter: DelimiterPair;
  placeholders: string[];
  schema: JSONSchema | null;
  onBack: () => void;
}

export default function Workspace({
  rawText, fileName, file, fileType, delimiter, placeholders, schema: serverSchema, onBack,
}: Props) {
  const schema = serverSchema || buildSchema(placeholders, fileName.replace(/\.[^.]+$/, ''));

  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const ph of placeholders) init[ph] = '';
    return init;
  });

  const [showSchema, setShowSchema] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [generating, setGenerating] = useState(false);
  const toastTimer = useRef<number>(0);
  const importRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const blob = await generateDocument(file, delimiter.open, delimiter.close, formData);
      const ext = fileType === 'docx' ? 'docx' : 'txt';
      const outName = fileName.replace(/\.[^.]+$/, '') + '_filled.' + ext;
      saveAs(blob, outName);
      notify('Document generated!');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
    saveAs(blob, fileName.replace(/\.[^.]+$/, '') + '_data.json');
    notify('JSON exported!');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      setFormData((prev) => {
        const next = { ...prev };
        for (const ph of placeholders) {
          if (data[ph] !== undefined) next[ph] = data[ph];
        }
        return next;
      });
      notify('JSON imported!');
    } catch {
      notify('Invalid JSON file', 'error');
    }
    if (importRef.current) importRef.current.value = '';
  };

  const displaySchema = useMemo(() => {
    const clean = JSON.parse(JSON.stringify(schema));
    for (const key of Object.keys(clean.properties || {})) {
      delete clean.properties[key]._multiline;
    }
    return JSON.stringify(clean, null, 2);
  }, [schema]);

  return (
    <div className="workspace">
      <a href="#main-form" className="skip-link">Skip to form</a>

      <section className="panel panel-doc" aria-label="Document Preview">
        <div className="panel-header">
          <h2>Document Preview</h2>
          <button className="back-btn" onClick={onBack}>
            <span aria-hidden="true">&larr;</span> New Template
          </button>
        </div>
        <DocPreview rawText={rawText} delimiter={delimiter} formData={formData} />
      </section>

      <section className="panel panel-form" aria-label="Template Form" id="main-form">
        <div className="panel-header">
          <h2>Form — {placeholders.length} fields</h2>
          <button
            className="toggle-btn"
            aria-expanded={showSchema}
            onClick={() => setShowSchema((s) => !s)}
          >
            {showSchema ? 'Hide' : 'Show'} Schema
          </button>
        </div>

        {showSchema && <pre className="schema-display">{displaySchema}</pre>}

        <SchemaForm schema={schema} formData={formData} onChange={setFormData} />

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            aria-busy={generating}
          >
            {generating ? 'Generating...' : 'Generate Document'}
          </button>
          <button className="btn btn-outline" onClick={handleExportJson}>Export JSON</button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="sr-only"
            aria-label="Import JSON data file"
            onChange={handleImportFile}
          />
          <button className="btn btn-secondary" onClick={() => importRef.current?.click()}>
            Import JSON
          </button>
        </div>
      </section>

      <div role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast show toast-${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
