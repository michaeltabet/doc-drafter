import io
import re
import json
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
from docx import Document

app = FastAPI(title="Doc Drafter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_pdf_text(data: bytes) -> str:
    """Extract text from PDF using pdfplumber, fallback to OCR for scanned pages."""
    text_parts = []
    has_text = False

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(page_text)
                has_text = True
            else:
                text_parts.append("")  # placeholder for OCR

    # If any pages had no text, run OCR on those pages
    if not all(t.strip() for t in text_parts):
        try:
            images = convert_from_bytes(data)
            for i, img in enumerate(images):
                if not text_parts[i].strip():
                    ocr_text = pytesseract.image_to_string(img)
                    text_parts[i] = ocr_text
        except Exception as e:
            # If OCR fails, continue with what we have
            pass

    return "\n\n".join(text_parts)


def extract_docx_text(data: bytes) -> str:
    """Extract text from DOCX preserving paragraph structure."""
    doc = Document(io.BytesIO(data))
    parts = []
    for para in doc.paragraphs:
        parts.append(para.text)
    # Also extract from tables
    for table in doc.tables:
        for row in table.rows:
            row_text = "\t".join(cell.text for cell in row.cells)
            parts.append(row_text)
    return "\n".join(parts)


def extract_image_text(data: bytes) -> str:
    """OCR an image file directly."""
    img = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(img)


def extract_text(data: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        return extract_pdf_text(data)
    elif ext == "docx":
        return extract_docx_text(data)
    elif ext in ("png", "jpg", "jpeg", "tiff", "bmp", "gif", "webp"):
        return extract_image_text(data)
    else:
        # Try as plain text
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            return data.decode("latin-1")


def find_placeholders(text: str, open_delim: str, close_delim: str) -> list[str]:
    open_esc = re.escape(open_delim)
    close_esc = re.escape(close_delim)
    pattern = open_esc + r"\s*([\w][\w\s.\-]*)\s*" + close_esc
    found = list(dict.fromkeys(m.strip() for m in re.findall(pattern, text)))
    return found


def placeholder_to_label(name: str) -> str:
    return re.sub(r"[_\-.]", " ", name).title()


def guess_type(name: str) -> dict:
    n = name.lower()
    if "date" in n:
        return {"type": "string", "format": "date"}
    if "email" in n:
        return {"type": "string", "format": "email"}
    if "phone" in n or "tel" in n:
        return {"type": "string", "format": "tel"}
    if re.search(r"amount|price|total|cost|fee|salary|rate", n):
        return {"type": "number"}
    if re.search(r"count|quantity|num_|number_of", n):
        return {"type": "integer"}
    if re.search(r"address|description|notes|terms|clause|body", n):
        return {"type": "string", "multiline": True}
    return {"type": "string"}


def build_schema(placeholders: list[str], title: str) -> dict:
    properties = {}
    required = []
    for ph in placeholders:
        info = guess_type(ph)
        prop = {"type": info.get("type", "string"), "title": placeholder_to_label(ph)}
        if "format" in info:
            prop["format"] = info["format"]
        if info.get("multiline"):
            prop["_multiline"] = True
        properties[ph] = prop
        required.append(ph)

    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "title": title,
        "properties": properties,
        "required": required,
    }


def fill_docx(data: bytes, open_delim: str, close_delim: str, form_data: dict) -> bytes:
    """Fill a DOCX template preserving formatting."""
    doc = Document(io.BytesIO(data))

    def replace_in_paragraph(paragraph):
        # Combine all runs to find placeholders that span multiple runs
        full_text = "".join(run.text for run in paragraph.runs)
        for key, value in form_data.items():
            placeholder = f"{open_delim}{key}{close_delim}"
            if placeholder in full_text:
                full_text = full_text.replace(placeholder, str(value or ""))

        # Rewrite runs: put all text in first run, clear the rest
        if paragraph.runs:
            paragraph.runs[0].text = full_text
            for run in paragraph.runs[1:]:
                run.text = ""

    for para in doc.paragraphs:
        replace_in_paragraph(para)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    replace_in_paragraph(para)

    # Also handle headers/footers
    for section in doc.sections:
        for header_para in section.header.paragraphs:
            replace_in_paragraph(header_para)
        for footer_para in section.footer.paragraphs:
            replace_in_paragraph(footer_para)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


@app.post("/api/parse")
async def parse_template(
    file: UploadFile = File(...),
    open_delim: str = Form("{{"),
    close_delim: str = Form("}}"),
):
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(413, "File too large (max 50MB)")

    filename = file.filename or "document"
    text = extract_text(data, filename)

    if not text.strip():
        raise HTTPException(422, "Could not extract any text from this file")

    placeholders = find_placeholders(text, open_delim, close_delim)
    title = filename.rsplit(".", 1)[0] if "." in filename else filename
    schema = build_schema(placeholders, title) if placeholders else None

    return {
        "text": text,
        "placeholders": placeholders,
        "schema": schema,
        "filename": filename,
    }


@app.post("/api/generate")
async def generate_document(
    file: UploadFile = File(...),
    open_delim: str = Form("{{"),
    close_delim: str = Form("}}"),
    form_data: str = Form("{}"),
):
    data = await file.read()
    parsed_data = json.loads(form_data)
    filename = file.filename or "document"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "docx":
        filled = fill_docx(data, open_delim, close_delim, parsed_data)
        output_name = filename.rsplit(".", 1)[0] + "_filled.docx"
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        text = extract_text(data, filename)
        for key, value in parsed_data.items():
            pattern = re.escape(open_delim) + r"\s*" + re.escape(key) + r"\s*" + re.escape(close_delim)
            text = re.sub(pattern, str(value or ""), text)
        filled = text.encode("utf-8")
        output_name = filename.rsplit(".", 1)[0] + "_filled.txt"
        media_type = "text/plain"

    return StreamingResponse(
        io.BytesIO(filled),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{output_name}"'},
    )


@app.get("/api/health")
async def health():
    # Check tesseract is available
    try:
        version = pytesseract.get_tesseract_version()
        ocr_available = True
    except Exception:
        version = None
        ocr_available = False

    return {
        "status": "ok",
        "ocr_available": ocr_available,
        "tesseract_version": str(version) if version else None,
    }
