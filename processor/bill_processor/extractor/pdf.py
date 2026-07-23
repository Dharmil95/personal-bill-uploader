"""PDF text extraction and scanned-page rendering."""

from __future__ import annotations

import base64
import io

import fitz
from pypdf import PdfReader

from bill_processor import config


def extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(part for part in pages if part)


def render_pdf_pages_to_png_b64(file_bytes: bytes, *, max_pages: int = 1) -> list[str]:
    """Render first page(s) at 1x scale to keep vision VRAM low."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    images: list[str] = []
    try:
        page_count = min(len(doc), max_pages)
        for page_index in range(page_count):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
            images.append(base64.b64encode(pix.tobytes("png")).decode("ascii"))
    finally:
        doc.close()
    return images


def route_pdf_content(file_bytes: bytes) -> tuple[str | None, list[str] | None, str]:
    text = extract_pdf_text(file_bytes)
    if len(text.strip()) >= config.PDF_MIN_TEXT_CHARS:
        return text, None, "pdf_text"

    images_b64 = render_pdf_pages_to_png_b64(file_bytes)
    if not images_b64:
        raise RuntimeError("PDF has no extractable text and no renderable pages")
    return None, images_b64, "pdf_vision"
