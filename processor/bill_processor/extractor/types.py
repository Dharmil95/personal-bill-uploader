"""Types for extracted bill content before LLM."""

from __future__ import annotations

from dataclasses import dataclass, field

from bill_processor.extractor.image import ImageSlice


@dataclass(frozen=True)
class ExtractedContent:
    extraction_method: str
    text: str | None = None
    images_b64: list[str] | None = None
    slices: tuple[ImageSlice, ...] = field(default_factory=tuple)

    @property
    def uses_vision(self) -> bool:
        return bool(self.images_b64) or bool(self.slices)

    @property
    def is_tall_screenshot(self) -> bool:
        return any(s.kind in {"items", "totals"} for s in self.slices)

    def all_images_b64(self) -> list[str]:
        if self.slices:
            return [s.jpeg_b64 for s in self.slices]
        return list(self.images_b64 or [])
