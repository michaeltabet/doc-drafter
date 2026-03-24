import type { DelimiterPair, JSONSchema, JSONSchemaProperty } from "../types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractPlaceholders(
  text: string,
  delim: DelimiterPair
): string[] {
  const open = escapeRegex(delim.open);
  const close = escapeRegex(delim.close);
  const regex = new RegExp(open + "\\s*([\\w][\\w\\s.\\-]*)\\s*" + close, "g");
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[1].trim());
  }
  return [...found];
}

function placeholderToLabel(name: string): string {
  return name
    .replace(/[_\-.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessType(name: string): Partial<JSONSchemaProperty> {
  const n = name.toLowerCase();
  if (n.includes("date")) return { type: "string", format: "date" };
  if (n.includes("email")) return { type: "string", format: "email" };
  if (n.includes("phone") || n.includes("tel"))
    return { type: "string", format: "tel" };
  if (/amount|price|total|cost|fee|salary|rate/.test(n))
    return { type: "number" };
  if (/count|quantity|num_|number_of/.test(n)) return { type: "integer" };
  if (/address|description|notes|terms|clause|body/.test(n))
    return { type: "string", _multiline: true };
  return { type: "string" };
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
      type: info.type || "string",
      title: placeholderToLabel(ph),
      ...(info.format && { format: info.format }),
      ...(info._multiline && { _multiline: true }),
    };
    required.push(ph);
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    title,
    properties,
    required,
  };
}
