import { useState, useEffect, useRef } from 'react';
import type { DelimiterPair, JSONSchema } from './types';
import UploadView from './components/UploadView';
import Workspace from './components/Workspace';
import './App.css';

type View = 'upload' | 'workspace';

interface WorkspaceState {
  rawText: string;
  fileName: string;
  file: File;
  fileType: string;
  delimiter: DelimiterPair;
  placeholders: string[];
  schema: JSONSchema | null;
}

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [ws, setWs] = useState<WorkspaceState | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = view === 'workspace' && ws
      ? `Editing: ${ws.fileName} - Doc Drafter`
      : 'Doc Drafter - Template Filler';
  }, [view, ws]);

  const handleParsed = (result: {
    rawText: string;
    fileName: string;
    file: File;
    fileType: string;
    delimiter: DelimiterPair;
    placeholders: string[];
    schema: JSONSchema | null;
  }) => {
    setWs(result);
    setView('workspace');
  };

  const handleBack = () => {
    if (!confirm('Discard current form data and start over?')) return;
    setView('upload');
    setWs(null);
  };

  if (view === 'workspace' && ws) {
    return (
      <main ref={workspaceRef}>
        <Workspace {...ws} onBack={handleBack} />
      </main>
    );
  }

  return (
    <main>
      <UploadView onParsed={handleParsed} />
    </main>
  );
}
