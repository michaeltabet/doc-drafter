# Doc Drafter

Open-source document template filler. The easiest way to fill contracts and templates without breaking the formatting.

**Upload a document → pick your placeholders → fill a form → generate the document.**

## How it works

1. **Upload** any document — DOCX, PDF, TXT, or any text file with placeholders
2. **Pick your delimiter** — `{{ }}`, `[ ]`, `<< >>`, `%% %%`, or define your own (like Excel asks for your CSV delimiter)
3. **Auto-generated form** — placeholders are extracted and turned into a JSON Schema, rendered as a clean form
4. **Live preview** — see your values fill into the document in real-time, side by side
5. **Generate** — download the filled document (preserves DOCX formatting) or export/import the data as JSON

## Why?

Every time you need to fill a contract or template, you either:
- Manually find-and-replace placeholders (error-prone, breaks formatting)
- Use expensive SaaS tools that lock you in
- Build a custom solution from scratch

Doc Drafter sits in the middle: **simple, open-source, no backend needed**. Your documents never leave your browser.

## Tech stack

- React + TypeScript + Vite
- JSZip for DOCX parsing/generation
- PDF.js for PDF text extraction
- Custom JSON Schema form renderer
- Fully client-side — no server processing, no data sent anywhere

## Run locally

```bash
npm install
npm run dev
```

## Deploy with Docker

```bash
docker compose up -d --build
```

## JSON Schema

When you upload a template, Doc Drafter auto-generates a JSON Schema from the placeholders. For example, a contract with `{{client_name}}`, `{{contract_date}}`, `{{total_amount}}` produces:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "my-contract",
  "properties": {
    "client_name": { "type": "string", "title": "Client Name" },
    "contract_date": { "type": "string", "title": "Contract Date", "format": "date" },
    "total_amount": { "type": "number", "title": "Total Amount" }
  },
  "required": ["client_name", "contract_date", "total_amount"]
}
```

Field types are auto-detected from placeholder names (dates, emails, amounts, etc.).

You can **export** the filled data as JSON and **import** it later to pre-fill the form — useful for filling the same template with different data.

## License

MIT
