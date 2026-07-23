"""Route file bytes to text or vision content based on mime type."""

from __future__ import annotations

from bill_processor.extractor.image import build_image_slices, is_image_mime
from bill_processor.extractor.pdf import route_pdf_content
from bill_processor.extractor.types import ExtractedContent


def extract_content(*, file_bytes: bytes, mime_type: str | None, filename: str) -> ExtractedContent:
    mime = (mime_type or "").lower()

    if is_image_mime(mime) or _looks_like_image(filename):
        slices = tuple(build_image_slices(file_bytes))
        return ExtractedContent(
            extraction_method="image_vision",
            images_b64=[s.jpeg_b64 for s in slices],
            slices=slices,
        )

    if mime == "application/pdf" or filename.lower().endswith(".pdf"):
        text, images_b64, method = route_pdf_content(file_bytes)
        if text is not None:
            return ExtractedContent(extraction_method=method, text=text)
        return ExtractedContent(extraction_method=method, images_b64=images_b64)

    raise RuntimeError(f"Unsupported file type: mime={mime_type!r} filename={filename!r}")


def _looks_like_image(filename: str) -> bool:
    lower = filename.lower()
    return lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic"))
