import { useState } from 'react';
import type { DelimiterPair } from './types';
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
  schema: any;
}

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [ws, setWs] = useState<WorkspaceState | null>(null);

  const handleParsed = (
    rawText: string,
    fileName: string,
    file: File,
    fileType: string,
    delimiter: DelimiterPair,
    placeholders: string[],
    schema: any
  ) => {
    setWs({ rawText, fileName, file, fileType, delimiter, placeholders, schema });
    setView('workspace');
  };

  if (view === 'workspace' && ws) {
    return (
      <Workspace
        {...ws}
        onBack={() => { setView('upload'); setWs(null); }}
      />
    );
  }

  return <UploadView onParsed={handleParsed} />;
}
