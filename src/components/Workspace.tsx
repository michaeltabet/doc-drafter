import { useState, useMemo, useCallback } from 'react';
import { saveAs } from 'file-saver';
import type { DelimiterPair } from '../types';
import { buildSchema, fillText, generateDocx } from '../lib/parser';
import SchemaForm from './SchemaForm';
import DocPreview from './DocPreview';

interface Props {
  rawText: string;
  fileName: string;
  fileData: ArrayBuffer | null;
  fileType: string;
  delimiter: DelimiterPair;
  placeholders: string[];
  onBack: () => void;
}

export default function Workspace({
  rawText, fileName, fileData, fileType, delimiter, placeholders, onBack,
}: Props) {
  const schema = useMemo(
    () => buildSchema(placeholders, fileName.replace(/\.[^.]+$/, '')),
    [placeholders, fileName]
  );

  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const ph of placeholders) init[ph] = '';
    return init;
  });

  const [showSchema, setShowSchema] = useState(false);
  const [toast, setToast] = useState('');

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const handleGenerate = async () => {
    if (fileType === 'docx' && fileData) {
      try {
        const blob = await generateDocx(fileData, delimiter, formData);
        saveAs(blob, fileName.replace(/\.docx$/i, '_filled.docx'));
        notify('DOCX generated!');
        return;
      } catch {
        // fall through to text
      }
    }
    const filled = fillText(rawText, delimiter, formData);
    const blob = new Blob([filled], { type: 'text/plain' });
    saveAs(blob, fileName.replace(/\.[^.]+$/, '') + '_filled.txt');
    notify('Document generated!');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(formData, null, 2)], {
      type: 'application/json',
    });
    saveAs(blob, fileName.replace(/\.[^.]+$/, '') + '_data.json');
    notify('JSON exported!');
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      if (!input.files?.length) return;
      const text = await input.files[0].text();
      try {
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
        notify('Invalid JSON file');
      }
    };
    input.click();
  };

  // Clean schema for display
  const displaySchema = useMemo(() => {
    const clean = JSON.parse(JSON.stringify(schema));
    for (const key of Object.keys(clean.properties)) {
      delete clean.properties[key]._multiline;
    }
    return JSON.stringify(clean, null, 2);
  }, [schema]);

  return (
    <div className="workspace">
      {/* Left: Doc preview */}
      <div className="panel panel-doc">
        <div className="panel-header">
          <span>Document Preview</span>
          <button className="back-btn" onClick={onBack}>
            ← New Template
          </button>
        </div>
        <DocPreview
          rawText={rawText}
          delimiter={delimiter}
          formData={formData}
        />
      </div>

      {/* Right: Form */}
      <div className="panel panel-form">
        <div className="panel-header">
          <span>Form — {placeholders.length} fields</span>
          <button
            className="toggle-btn"
            onClick={() => setShowSchema((s) => !s)}
          >
            {showSchema ? 'Hide' : 'Show'} Schema
          </button>
        </div>

        {showSchema && (
          <pre className="schema-display">{displaySchema}</pre>
        )}

        <SchemaForm
          schema={schema}
          formData={formData}
          onChange={setFormData}
        />

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleGenerate}>
            Generate Document
          </button>
          <button className="btn btn-outline" onClick={handleExportJson}>
            Export JSON
          </button>
          <button className="btn btn-secondary" onClick={handleImportJson}>
            Import JSON
          </button>
        </div>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
