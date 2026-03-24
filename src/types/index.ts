export interface DelimiterPair {
  open: string;
  close: string;
  label: string;
}

export const DELIMITER_PRESETS: DelimiterPair[] = [
  { open: '{{', close: '}}', label: '{{ }}' },
  { open: '{', close: '}', label: '{ }' },
  { open: '[', close: ']', label: '[ ]' },
  { open: '[[', close: ']]', label: '[[ ]]' },
  { open: '<<', close: '>>', label: '<< >>' },
  { open: '%%', close: '%%', label: '%% %%' },
  { open: '${', close: '}', label: '${ }' },
];

export interface TemplateState {
  rawText: string;
  fileName: string;
  fileData: ArrayBuffer | null;
  fileType: string;
  delimiter: DelimiterPair;
  placeholders: string[];
  schema: JSONSchema | null;
  formData: Record<string, unknown>;
}

export interface JSONSchema {
  $schema: string;
  type: string;
  title: string;
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
}

export interface JSONSchemaProperty {
  type: string;
  title: string;
  format?: string;
  description?: string;
  _multiline?: boolean;
}
