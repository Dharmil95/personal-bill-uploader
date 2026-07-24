"""Image mime validation and tall-screenshot slicing for vision."""

from __future__ import annotations

import base64
import io
from dataclasses import dataclass

from PIL import Image

from bill_processor import config

IMAGE_MIME_PREFIX = "image/"


@dataclass(frozen=True)
class ImageSlice:
    kind: str  # "items" | "items_tail" | "totals" | "full"
    index: int
    top: int
    bottom: int
    jpeg_b64: str


def is_image_mime(mime_type: str | None) -> bool:
    return bool(mime_type and mime_type.startswith(IMAGE_MIME_PREFIX))


def _encode_jpeg(img: Image.Image, *, quality: int = 82) -> str:
    rgb = img.convert("RGB")
    out = io.BytesIO()
    rgb.save(out, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(out.getvalue()).decode("ascii")


def _resize_to_max_side(img: Image.Image, max_side: int) -> Image.Image:
    width, height = img.size
    longest = max(width, height)
    if longest <= max_side:
        return img
    scale = max_side / float(longest)
    return img.resize(
        (max(1, int(width * scale)), max(1, int(height * scale))),
        Image.Resampling.LANCZOS,
    )


def _crop_b64(img: Image.Image, top: int, bottom: int, *, max_side: int) -> str:
    width, height = img.size
    top = max(0, min(top, height - 1))
    bottom = max(top + 1, min(bottom, height))
    crop = img.crop((0, top, width, bottom))
    return _encode_jpeg(_resize_to_max_side(crop, max_side))


def build_image_slices(
    file_bytes: bytes, *, max_side: int | None = None
) -> list[ImageSlice]:
    """
    Build vision slices for a bill image.

    Short receipts → one full frame.
    Tall mobile screenshots → overlapping item windows + a dedicated end-of-list
    tail crop + a totals strip. The previous 0.82 height cutoff dropped the last
    JioMart products (e.g. dish wash + dahi) that sit just above "Delivering to".
    """
    side = config.VISION_MAX_SIDE if max_side is None else max_side
    max_item_slices = config.MAX_ITEM_SLICES

    with Image.open(io.BytesIO(file_bytes)) as img:
        img = img.convert("RGB")
        width, height = img.size

        if height <= width * 1.8:
            return [
                ImageSlice(
                    kind="full",
                    index=0,
                    top=0,
                    bottom=height,
                    jpeg_b64=_encode_jpeg(_resize_to_max_side(img, side)),
                )
            ]

        window = max(int(width * config.SLICE_WINDOW_RATIO), 900)
        overlap = int(window * config.SLICE_OVERLAP_RATIO)
        step = max(1, window - overlap)

        # Cover almost to the payment block — last products sit just above address
        items_bottom = max(window, int(height * 0.92))
        slices: list[ImageSlice] = []
        top = 0
        index = 0
        while top < items_bottom and index < max_item_slices:
            bottom = min(items_bottom, top + window)
            slices.append(
                ImageSlice(
                    kind="items",
                    index=index,
                    top=top,
                    bottom=bottom,
                    jpeg_b64=_crop_b64(img, top, bottom, max_side=side),
                )
            )
            index += 1
            if bottom >= items_bottom:
                break
            top += step

        # Explicit tail crop: last ~products above delivery/payment
        tail_h = min(height, max(int(width * 1.8), 1800))
        tail_top = max(0, items_bottom - tail_h)
        tail_bottom = min(height, items_bottom + int(width * 0.35))
        slices.append(
            ImageSlice(
                kind="items_tail",
                index=index,
                top=tail_top,
                bottom=tail_bottom,
                jpeg_b64=_crop_b64(img, tail_top, tail_bottom, max_side=side),
            )
        )
        index += 1

        totals_h = min(height, max(int(width * 1.4), 1400))
        slices.append(
            ImageSlice(
                kind="totals",
                index=index,
                top=height - totals_h,
                bottom=height,
                jpeg_b64=_crop_b64(img, height - totals_h, height, max_side=side),
            )
        )
        return slices


def image_bytes_to_jpeg_b64_list(
    file_bytes: bytes, *, max_side: int | None = None
) -> list[str]:
    return [s.jpeg_b64 for s in build_image_slices(file_bytes, max_side=max_side)]


def image_bytes_to_jpeg_b64(file_bytes: bytes, *, max_side: int | None = None) -> str:
    return image_bytes_to_jpeg_b64_list(file_bytes, max_side=max_side)[0]
