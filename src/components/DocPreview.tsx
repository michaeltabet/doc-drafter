import { useMemo } from 'react';
import type { DelimiterPair } from '../types';

interface Props {
  rawText: string;
  delimiter: DelimiterPair;
  formData: Record<string, unknown>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function DocPreview({ rawText, delimiter, formData }: Props) {
  const html = useMemo(() => {
    let h = escapeHtml(rawText);
    const open = escapeRegex(delimiter.open);
    const close = escapeRegex(delimiter.close);
    const regex = new RegExp(
      open + '\\s*([\\w][\\w\\s.\\-]*)\\s*' + close,
      'g'
    );
    h = h.replace(regex, (_match, name: string) => {
      const key = name.trim();
      const val = formData[key];
      if (val) {
        return `<span class="placeholder filled">${escapeHtml(String(val))}</span>`;
      }
      return `<span class="placeholder">${escapeHtml(delimiter.open + key + delimiter.close)}</span>`;
    });
    return h;
  }, [rawText, delimiter, formData]);

  return (
    <div className="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
