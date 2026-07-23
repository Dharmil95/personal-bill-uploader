"""LLM bill extraction and validation (header + line items)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from bill_processor import config
from bill_processor.extractor.types import ExtractedContent
from bill_processor.llm import client as ollama
from bill_processor.llm.prompts import (
    GAP_FILL_SYSTEM_PROMPT,
    ITEMS_ONLY_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    TOTALS_ONLY_SYSTEM_PROMPT,
    VALIDATION_SYSTEM_PROMPT,
    build_gap_fill_prompt,
    build_items_slice_prompt,
    build_totals_slice_prompt,
    build_user_prompt,
    build_validation_prompt,
)


@dataclass(frozen=True)
class LineItem:
    description: str
    quantity: Decimal | None
    unit: str | None
    rate: Decimal | None
    amount: Decimal | None


@dataclass(frozen=True)
class BillExtraction:
    vendor: str | None
    amount: Decimal | None
    currency: str
    bill_date: date | None
    confidence: float | None
    raw: dict[str, Any]
    model: str
    invoice_number: str | None = None
    subtotal: Decimal | None = None
    discount: Decimal | None = None
    delivery_fee: Decimal | None = None
    items: list[LineItem] = field(default_factory=list)
    declared_item_count: int | None = None


def extract_bill(
    *,
    content: ExtractedContent,
    filename: str,
    owner: str,
    category: str,
) -> BillExtraction:
    model = config.VISION_MODEL if content.uses_vision else config.LLM_MODEL

    if (
        content.uses_vision
        and config.CHUNKED_ITEM_EXTRACTION
        and content.is_tall_screenshot
        and any(s.kind == "items" for s in content.slices)
    ):
        first = _extract_tall_screenshot_chunked(
            content=content,
            filename=filename,
            owner=owner,
            category=category,
            model=model,
        )
    else:
        first = _extract_single_pass(
            content=content,
            filename=filename,
            owner=owner,
            category=category,
            model=model,
        )

    if not config.VALIDATE_EXTRACTION:
        return first

    return _run_validation_pass(
        content=content,
        filename=filename,
        model=model,
        first=first,
    )


def _extract_single_pass(
    *,
    content: ExtractedContent,
    filename: str,
    owner: str,
    category: str,
    model: str,
) -> BillExtraction:
    user_prompt = build_user_prompt(
        filename=filename,
        owner=owner,
        category=category,
        text=content.text,
    )
    path = "vision" if content.uses_vision else "text"
    print(f"Extraction path={path} model={model} (single pass)")

    if content.uses_vision:
        raw_text = ollama.chat(
            model=model,
            system=SYSTEM_PROMPT,
            user=user_prompt,
            images_b64=content.all_images_b64(),
        )
    else:
        if not content.text:
            raise RuntimeError("Chat extraction requires text content")
        raw_text = ollama.chat(
            model=model,
            system=SYSTEM_PROMPT,
            user=user_prompt,
        )

    return _to_extraction(_parse_json(raw_text), model=model)


def _extract_tall_screenshot_chunked(
    *,
    content: ExtractedContent,
    filename: str,
    owner: str,
    category: str,
    model: str,
) -> BillExtraction:
    """Extract totals from bottom crop; harvest items from each overlapping slice."""
    item_slices = [s for s in content.slices if s.kind in {"items", "items_tail"}]
    totals_slices = [s for s in content.slices if s.kind == "totals"]
    print(
        f"Extraction path=vision-chunked model={model} "
        f"item_slices={len(item_slices)} totals_slices={len(totals_slices)}"
    )

    header: BillExtraction | None = None
    if totals_slices:
        totals_raw = ollama.chat(
            model=model,
            system=TOTALS_ONLY_SYSTEM_PROMPT,
            user=build_totals_slice_prompt(filename=filename, owner=owner, category=category),
            images_b64=[totals_slices[0].jpeg_b64],
        )
        header = _to_extraction(_parse_json(totals_raw), model=model)
        print(f"Totals slice: amount={header.amount} vendor={header.vendor}")

    declared = header.declared_item_count if header else None
    harvested: list[LineItem] = []
    slice_dumps: list[dict[str, Any]] = []

    for slice_meta in item_slices:
        print(
            f"Item slice {slice_meta.index + 1}/{len(item_slices)} "
            f"kind={slice_meta.kind} y={slice_meta.top}-{slice_meta.bottom}"
        )
        raw_text = ollama.chat(
            model=model,
            system=ITEMS_ONLY_SYSTEM_PROMPT,
            user=build_items_slice_prompt(
                filename=filename,
                slice_index=slice_meta.index,
                slice_count=len(item_slices),
            ),
            images_b64=[slice_meta.jpeg_b64],
        )
        parsed = _parse_json(raw_text)
        slice_dumps.append({"kind": slice_meta.kind, **parsed})
        if declared is None:
            declared = _parse_declared_count(parsed.get("declared_item_count"))
        harvested.extend(_parse_items(parsed.get("items")))

    merged_items = _dedupe_items(harvested)
    print(f"Chunked harvest: raw={len(harvested)} deduped={len(merged_items)} declared={declared}")

    if header is None:
        header = BillExtraction(
            vendor=None,
            amount=None,
            currency=config.DEFAULT_CURRENCY,
            bill_date=None,
            confidence=None,
            raw={},
            model=model,
            items=[],
        )

    # If count/sum still short, hunt missing rows on the end-of-list crops
    merged_items, gap_raw = _maybe_gap_fill(
        filename=filename,
        model=model,
        items=merged_items,
        declared=declared,
        grand_total=header.amount,
        gap_images=[
            s.jpeg_b64
            for s in content.slices
            if s.kind in {"items_tail", "totals"}
        ][-2:],
    )

    raw = {
        "mode": "chunked",
        "totals": header.raw,
        "item_slices": slice_dumps,
        "gap_fill": gap_raw,
        "declared_item_count": declared,
        "vendor": header.vendor,
        "amount": float(header.amount) if header.amount is not None else None,
        "currency": header.currency,
        "bill_date": header.bill_date.isoformat() if header.bill_date else None,
        "invoice_number": header.invoice_number,
        "subtotal": float(header.subtotal) if header.subtotal is not None else None,
        "discount": float(header.discount) if header.discount is not None else None,
        "delivery_fee": float(header.delivery_fee) if header.delivery_fee is not None else None,
        "items": [_item_to_dict(item) for item in merged_items],
        "confidence": header.confidence,
        "note": f"chunked extraction; declared={declared}; items={len(merged_items)}",
    }

    return BillExtraction(
        vendor=header.vendor,
        amount=header.amount,
        currency=header.currency,
        bill_date=header.bill_date,
        confidence=header.confidence,
        raw=raw,
        model=f"{model}+chunked",
        invoice_number=header.invoice_number,
        subtotal=header.subtotal,
        discount=header.discount,
        delivery_fee=header.delivery_fee,
        items=merged_items,
        declared_item_count=declared,
    )


def _maybe_gap_fill(
    *,
    filename: str,
    model: str,
    items: list[LineItem],
    declared: int | None,
    grand_total: Decimal | None,
    gap_images: list[str],
) -> tuple[list[LineItem], dict[str, Any] | None]:
    """Extra Gemma call when declared count or amount sum shows missing end-of-list rows."""
    if not gap_images:
        return items, None

    items_sum = _items_amount_sum(items)
    amount_gap: Decimal | None = None
    if grand_total is not None and items_sum is not None:
        amount_gap = grand_total - items_sum

    count_short = declared is not None and len(items) < declared
    count_over = declared is not None and len(items) > declared
    # JioMart case: 20/22 items, gap ≈ 74 (29+45)
    sum_short = amount_gap is not None and Decimal("0.5") < amount_gap <= Decimal("500")
    sum_over = amount_gap is not None and amount_gap < Decimal("-1")

    if count_over or sum_over:
        print(
            f"Skip gap-fill (over-extracted): items={len(items)} declared={declared} gap={amount_gap}"
        )
        return _dedupe_items(items), {"skipped": "over_extracted"}

    if not count_short and not sum_short:
        return items, None

    print(
        f"Gap-fill pass: items={len(items)} declared={declared} "
        f"sum={items_sum} total={grand_total} gap={amount_gap}"
    )
    prompt = build_gap_fill_prompt(
        filename=filename,
        existing_items=[_item_to_dict(item) for item in items],
        expected_item_count=declared,
        amount_gap=float(amount_gap) if amount_gap is not None else None,
        grand_total=float(grand_total) if grand_total is not None else None,
    )
    raw_text = ollama.chat(
        model=model,
        system=GAP_FILL_SYSTEM_PROMPT,
        user=prompt,
        images_b64=gap_images,
    )
    parsed = _parse_json(raw_text)
    missing = _parse_items(parsed.get("missing_items") or parsed.get("items"))
    if not missing:
        print("Gap-fill found no additional items.")
        return items, parsed

    merged = _dedupe_items([*items, *missing])
    print(f"Gap-fill added {len(merged) - len(items)} item(s) → {len(merged)} total")
    return merged, parsed


def _run_validation_pass(
    *,
    content: ExtractedContent,
    filename: str,
    model: str,
    first: BillExtraction,
) -> BillExtraction:
    expected = first.declared_item_count
    first_items = _dedupe_items(first.items)
    first = BillExtraction(
        vendor=first.vendor,
        amount=first.amount,
        currency=first.currency,
        bill_date=first.bill_date,
        confidence=first.confidence,
        raw=first.raw,
        model=first.model,
        invoice_number=first.invoice_number,
        subtotal=first.subtotal,
        discount=first.discount,
        delivery_fee=first.delivery_fee,
        items=first_items,
        declared_item_count=first.declared_item_count,
    )

    target = _target_items_total(
        grand_total=first.amount,
        subtotal=first.subtotal,
        delivery_fee=first.delivery_fee,
    )
    first_score = _items_score(
        first.items,
        target_total=target,
        expected_count=expected,
    )
    # Already reconciles well (e.g. vegetable invoice 17 rows ≈ subtotal) — skip pass 2
    if first_score <= Decimal("2") and (
        expected is None or abs(len(first.items) - expected) <= 0
    ):
        print(
            f"Skip validation (pass1 already good): items={len(first.items)} "
            f"score={first_score} expected={expected}"
        )
        return first

    print(
        f"Validation pass model={model} "
        f"first_items={len(first.items)} first_amount={first.amount} expected={expected}"
    )
    try:
        validation_user = build_validation_prompt(
            filename=filename,
            first_pass=first.raw if isinstance(first.raw, dict) else {},
            text=content.text,
            expected_item_count=expected,
        )
        # Prefer item slices + totals for tall bills so missing mid-list rows are visible
        images = content.all_images_b64()
        if content.uses_vision:
            second_raw = ollama.chat(
                model=model,
                system=VALIDATION_SYSTEM_PROMPT,
                user=validation_user,
                images_b64=images,
            )
        else:
            second_raw = ollama.chat(
                model=model,
                system=VALIDATION_SYSTEM_PROMPT,
                user=validation_user,
            )
        second_parsed = _parse_json(second_raw)
        second = _to_extraction(second_parsed, model=model)
        if expected is None:
            expected = second.declared_item_count
        merged = _merge_passes(
            first=first,
            second=second,
            first_raw=first.raw if isinstance(first.raw, dict) else {},
            second_raw=second_parsed,
            expected_item_count=expected,
        )
        print(
            f"Validation done items={len(merged.items)} amount={merged.amount} "
            f"(pass1={len(first.items)} → pass2={len(second.items)}) expected={expected}"
        )
        return merged
    except Exception as exc:
        print(f"Validation pass failed ({exc}); keeping prior extraction.")
        raw = dict(first.raw) if isinstance(first.raw, dict) else {"prior": first.raw}
        raw["_validation_error"] = str(exc)
        return BillExtraction(
            vendor=first.vendor,
            amount=first.amount,
            currency=first.currency,
            bill_date=first.bill_date,
            confidence=first.confidence,
            raw=raw,
            model=first.model,
            invoice_number=first.invoice_number,
            subtotal=first.subtotal,
            discount=first.discount,
            delivery_fee=first.delivery_fee,
            items=first.items,
            declared_item_count=first.declared_item_count,
        )


def _parse_json(raw_text: str) -> dict[str, Any]:
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            raise RuntimeError(f"LLM did not return JSON: {raw_text[:300]}")
        return json.loads(match.group(0))


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _parse_amount(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip().replace(",", "").replace("₹", "").replace("Rs.", "").strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


def _parse_declared_count(value: Any) -> int | None:
    if value is None:
        return None
    try:
        count = int(value)
    except (TypeError, ValueError):
        return None
    return count if count > 0 else None


def _parse_items(raw_items: Any) -> list[LineItem]:
    if not isinstance(raw_items, list):
        return []
    items: list[LineItem] = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            continue
        description = str(
            entry.get("description")
            or entry.get("name")
            or entry.get("item")
            or ""
        ).strip()
        if not description:
            continue
        unit_raw = entry.get("unit")
        unit = str(unit_raw).strip() if unit_raw else None
        items.append(
            LineItem(
                description=description[:500],
                quantity=_parse_amount(entry.get("quantity")),
                unit=unit or None,
                rate=_parse_amount(entry.get("rate") or entry.get("unit_price")),
                amount=_parse_amount(entry.get("amount") or entry.get("total")),
            )
        )
    return items


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_desc(description: str) -> str:
    text = description.lower().strip()
    text = re.sub(r"\s+", "", text)
    text = text.replace("(", "").replace(")", "").replace("/", "").replace("-", "")
    return text


def _item_key(item: LineItem) -> str:
    amount = f"{item.amount:.2f}" if item.amount is not None else ""
    qty = f"{item.quantity:.3f}" if item.quantity is not None else ""
    return f"{_normalize_desc(item.description)}|{qty}|{amount}"


def _amounts_close(a: Decimal | None, b: Decimal | None, *, tol: Decimal = Decimal("0.05")) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tol


def _dedupe_items(items: list[LineItem]) -> list[LineItem]:
    """Drop duplicates from overlaps/validation (exact + fuzzy qty/amount match)."""
    out: list[LineItem] = []
    for item in items:
        key = _item_key(item)
        duplicate = False
        for existing in out:
            if key == _item_key(existing):
                duplicate = True
                break
            # Same paid amount + qty with very similar name → duplicate
            if (
                _amounts_close(item.amount, existing.amount)
                and _amounts_close(item.quantity, existing.quantity, tol=Decimal("0.01"))
                and (
                    _normalize_desc(item.description) == _normalize_desc(existing.description)
                    or _normalize_desc(item.description) in _normalize_desc(existing.description)
                    or _normalize_desc(existing.description) in _normalize_desc(item.description)
                )
            ):
                duplicate = True
                break
            # Same amount+qty alone is enough when both descriptions share a long stem
            if (
                _amounts_close(item.amount, existing.amount)
                and _amounts_close(item.quantity, existing.quantity, tol=Decimal("0.01"))
                and item.amount is not None
            ):
                a = _normalize_desc(item.description)
                b = _normalize_desc(existing.description)
                stem_a = re.split(r"[(\u0a80-\u0aff]", a)[0][:8]
                stem_b = re.split(r"[(\u0a80-\u0aff]", b)[0][:8]
                if stem_a and stem_a == stem_b:
                    duplicate = True
                    break
        if not duplicate:
            out.append(item)
    return out


def _target_items_total(
    *,
    grand_total: Decimal | None,
    subtotal: Decimal | None,
    delivery_fee: Decimal | None,
) -> Decimal | None:
    if subtotal is not None:
        return subtotal
    if grand_total is None:
        return None
    fee = delivery_fee or Decimal("0")
    return grand_total - fee


def _items_score(
    items: list[LineItem],
    *,
    target_total: Decimal | None,
    expected_count: int | None,
) -> Decimal:
    """Lower is better."""
    score = Decimal("0")
    items_sum = _items_amount_sum(items)
    if target_total is not None and items_sum is not None:
        score += abs(items_sum - target_total)
    elif target_total is not None:
        score += Decimal("1000")
    if expected_count is not None:
        score += Decimal(abs(len(items) - expected_count)) * Decimal("5")
    # Mild penalty for very long lists (duplicate inflation)
    score += Decimal(max(0, len(items) - 30)) * Decimal("2")
    return score


def _item_to_dict(item: LineItem) -> dict[str, Any]:
    return {
        "description": item.description,
        "quantity": float(item.quantity) if item.quantity is not None else None,
        "unit": item.unit,
        "rate": float(item.rate) if item.rate is not None else None,
        "amount": float(item.amount) if item.amount is not None else None,
    }


def _items_amount_sum(items: list[LineItem]) -> Decimal | None:
    totals = [item.amount for item in items if item.amount is not None]
    if not totals:
        return None
    return sum(totals, Decimal("0"))


def _to_extraction(parsed: dict[str, Any], *, model: str) -> BillExtraction:
    vendor = _optional_text(parsed.get("vendor"))
    amount = _parse_amount(parsed.get("amount"))
    currency = (
        str(parsed.get("currency") or config.DEFAULT_CURRENCY).strip().upper()
        or config.DEFAULT_CURRENCY
    )
    bill_date = _parse_date(parsed.get("bill_date"))
    invoice_number = _optional_text(parsed.get("invoice_number") or parsed.get("order_id"))
    subtotal = _parse_amount(parsed.get("subtotal"))
    discount = _parse_amount(parsed.get("discount"))
    delivery_fee = _parse_amount(parsed.get("delivery_fee"))
    items = _parse_items(parsed.get("items"))
    declared = _parse_declared_count(parsed.get("declared_item_count"))

    confidence_raw = parsed.get("confidence")
    confidence: float | None
    if confidence_raw is None:
        confidence = None
    else:
        confidence = max(0.0, min(float(confidence_raw), 1.0))

    return BillExtraction(
        vendor=vendor,
        amount=amount,
        currency=currency,
        bill_date=bill_date,
        confidence=confidence,
        raw=parsed,
        model=model,
        invoice_number=invoice_number,
        subtotal=subtotal,
        discount=discount,
        delivery_fee=delivery_fee,
        items=items,
        declared_item_count=declared,
    )


def _merge_passes(
    *,
    first: BillExtraction,
    second: BillExtraction,
    first_raw: dict[str, Any],
    second_raw: dict[str, Any],
    expected_item_count: int | None,
) -> BillExtraction:
    """Pick the better item list; avoid union that inflates duplicates."""
    amount = first.amount if first.amount is not None else second.amount
    delivery = second.delivery_fee if second.delivery_fee is not None else first.delivery_fee
    subtotal = second.subtotal if second.subtotal is not None else first.subtotal
    target = _target_items_total(
        grand_total=amount,
        subtotal=subtotal,
        delivery_fee=delivery,
    )
    expected = (
        expected_item_count
        or second.declared_item_count
        or first.declared_item_count
    )

    first_items = _dedupe_items(first.items)
    second_items = _dedupe_items(second.items)
    union_items = _dedupe_items([*first_items, *second_items])

    candidates = [
        ("pass1", first_items),
        ("pass2", second_items),
        ("union", union_items),
    ]
    # Prefer shorter accurate lists when expected count is known
    scored = sorted(
        candidates,
        key=lambda pair: (
            _items_score(pair[1], target_total=target, expected_count=expected),
            # tie-break: closer to expected count, then fewer items
            abs(len(pair[1]) - expected) if expected is not None else 0,
            len(pair[1]),
        ),
    )
    items_from, items = scored[0]

    # Never keep a union that is clearly longer than expected when a better candidate exists
    if expected is not None and items_from == "union" and len(items) > expected:
        for name, cand in scored:
            if name != "union" and len(cand) <= expected + 1:
                items_from, items = name, cand
                break

    raw = {
        "pass1": first_raw,
        "pass2": second_raw,
        "merged": {
            "items_from": items_from,
            "amount_from": "pass1" if first.amount is not None else "pass2",
            "pass1_item_count": len(first_items),
            "pass2_item_count": len(second_items),
            "final_item_count": len(items),
            "expected_item_count": expected,
            "target_items_total": float(target) if target is not None else None,
            "missing_count": second_raw.get("missing_count"),
            "items_complete": second_raw.get("items_complete"),
        },
        "vendor": second.vendor or first.vendor,
        "amount": float(amount) if amount is not None else None,
        "currency": second.currency or first.currency,
        "bill_date": (second.bill_date or first.bill_date).isoformat()
        if (second.bill_date or first.bill_date)
        else None,
        "declared_item_count": expected,
        "items": [_item_to_dict(item) for item in items],
    }

    return BillExtraction(
        vendor=second.vendor or first.vendor,
        amount=amount,
        currency=second.currency or first.currency,
        bill_date=second.bill_date or first.bill_date,
        confidence=second.confidence if second.confidence is not None else first.confidence,
        raw=raw,
        model=f"{first.model}+validate",
        invoice_number=second.invoice_number or first.invoice_number,
        subtotal=subtotal,
        discount=second.discount if second.discount is not None else first.discount,
        delivery_fee=delivery,
        items=items,
        declared_item_count=expected,
    )
