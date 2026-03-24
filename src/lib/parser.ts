import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import type { DelimiterPair, JSONSchema, JSONSchemaProperty } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const ab = await file.arrayBuffer();

  if (ext === 'pdf') return extractPdfText(ab);
  if (ext === 'docx') return extractDocxText(ab);
  return new TextDecoder().decode(ab);
}

async function extractPdfText(ab: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return text;
}

async function extractDocxText(ab: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(ab);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Not a valid DOCX file');
  const xml = await xmlFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const paragraphs = doc.getElementsByTagName('w:p');
  let text = '';
  for (const p of paragraphs) {
    const runs = p.getElementsByTagName('w:t');
    let pText = '';
    for (const r of runs) pText += r.textContent || '';
    text += pText + '\n';
  }
  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractPlaceholders(text: string, delim: DelimiterPair): string[] {
  const open = escapeRegex(delim.open);
  const close = escapeRegex(delim.close);
  const regex = new RegExp(
    open + '\\s*([\\w][\\w\\s.\\-]*)\\s*' + close,
    'g'
  );
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[1].trim());
  }
  return [...found];
}

function placeholderToLabel(name: string): string {
  return name
    .replace(/[_\-.]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessType(name: string): Partial<JSONSchemaProperty> {
  const n = name.toLowerCase();
  if (n.includes('date')) return { type: 'string', format: 'date' };
  if (n.includes('email')) return { type: 'string', format: 'email' };
  if (n.includes('phone') || n.includes('tel')) return { type: 'string', format: 'tel' };
  if (/amount|price|total|cost|fee|salary|rate/.test(n)) return { type: 'number' };
  if (/count|quantity|num_|number_of/.test(n)) return { type: 'integer' };
  if (/address|description|notes|terms|clause|body/.test(n))
    return { type: 'string', _multiline: true };
  return { type: 'string' };
}

export function buildSchema(
  placeholders: string[],
  title: string
): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const ph of placeholders) {
    const info = guessType(ph);
    properties[ph] = {
      type: info.type || 'string',
      title: placeholderToLabel(ph),
      ...(info.format && { format: info.format }),
      ...(info._multiline && { _multiline: true }),
    };
    required.push(ph);
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title,
    properties,
    required,
  };
}

export function fillText(
  text: string,
  delim: DelimiterPair,
  formData: Record<string, unknown>
): string {
  let output = text;
  for (const [key, value] of Object.entries(formData)) {
    const open = escapeRegex(delim.open);
    const close = escapeRegex(delim.close);
    const regex = new RegExp(open + '\\s*' + escapeRegex(key) + '\\s*' + close, 'g');
    output = output.replace(regex, String(value || ''));
  }
  return output;
}

export async function generateDocx(
  originalData: ArrayBuffer,
  delim: DelimiterPair,
  formData: Record<string, unknown>
): Promise<Blob> {
  const zip = await JSZip.loadAsync(originalData);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Not a valid DOCX');
  let xml = await xmlFile.async('string');

  for (const [key, value] of Object.entries(formData)) {
    const open = escapeRegex(delim.open);
    const close = escapeRegex(delim.close);
    const regex = new RegExp(open + '\\s*' + escapeRegex(key) + '\\s*' + close, 'g');
    const escaped = String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    xml = xml.replace(regex, escaped);
  }

  zip.file('word/document.xml', xml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
