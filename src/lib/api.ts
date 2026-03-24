const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ParseResult {
  text: string;
  placeholders: string[];
  schema: any | null;
  filename: string;
}

export async function parseTemplate(
  file: File,
  openDelim: string,
  closeDelim: string
): Promise<ParseResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('open_delim', openDelim);
  form.append('close_delim', closeDelim);

  const res = await fetch(`${API_BASE}/parse`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to parse template');
  }
  return res.json();
}

export async function generateDocument(
  file: File,
  openDelim: string,
  closeDelim: string,
  formData: Record<string, unknown>
): Promise<Blob> {
  const form = new FormData();
  form.append('file', file);
  form.append('open_delim', openDelim);
  form.append('close_delim', closeDelim);
  form.append('form_data', JSON.stringify(formData));

  const res = await fetch(`${API_BASE}/generate`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to generate document');
  }
  return res.blob();
}

export async function healthCheck(): Promise<{ status: string; ocr_available: boolean; tesseract_version: string | null }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
