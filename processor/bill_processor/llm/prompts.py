"""Prompts for bill extraction including line items."""

from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You extract structured expense data from Indian bills and receipts (images or text).

Bill totals:
- amount: FINAL amount payable / Grand Total / Total after discount and fees.
  Never use MRP Total, Credpay mid-lines, a single item price, or a random number from the page.
- Prefer labels: "Grand Total", "Total", "Amount Payable", "Total Payable", "Net Payable".
- bill_date: date printed on the invoice as ISO YYYY-MM-DD.
  Prefer "Dated" / "Order Date" on the bill over the filename.
  Do not invent years (e.g. do not turn 2026 into 2023).
- vendor: shop / merchant name exactly as printed (short brand name is OK, e.g. JioMart).
- currency: ISO code, default INR.
- invoice_number: Order ID / Invoice No if present, else null.
- subtotal / discount / delivery_fee: only if clearly shown; discount as a positive number; delivery 0 if marked Free.

Line items (critical — descriptions must be accurate):
- items: EVERY product/goods row. Do not skip items. Do not invent items that are not on the bill.
- If the bill has a "Sl No." / serial column, return EXACTLY that many items (last Sl No. = items length). Never duplicate a row.
- description: copy the product / "Description of Goods" text EXACTLY as printed on that row.
  - Keep spelling as on the bill (even typos like "Poteto", "Tometo", "Corinder").
  - Keep mixed English+Gujarati EXACTLY as printed (e.g. "Parvar/પરવર", "Poteto(દેશીબટાટા)").
  - Do NOT invent Gujarati or English glosses that are not on the bill.
  - Do NOT rewrite, translate, autocorrect, or "improve" the name (do not turn Parvar into Capsicum, Bottle Gourd into Cabbage, etc.).
  - Do NOT put prices, quantities, MRP, discounts, or currency symbols in description.
  - Do NOT merge two products into one description.
  - Do NOT use category labels, section headers, or address/phone lines as items.
  - Include brand + product + size when they appear on the same line (e.g. "Amul Gold Full Cream Milk Pouch 500 ml").
- quantity: numeric qty only (null if unknown). Never put qty text into description.
- unit: e.g. kgs, pcs, ml, L — null if unknown.
- rate: unit price number only — null if unknown.
- amount: line total number only — null if unknown.
- Skip non-product rows: headers, totals, round-off, delivery, tax-only rows, payment method lines.
- declared_item_count: last Sl No. or "Items in this order (N)" if present, else null.

confidence: 0-1 for how sure you are of the grand total and date.
note: one short line.

Respond ONLY with JSON:
{
  "vendor": str|null,
  "amount": number|null,
  "currency": str,
  "bill_date": str|null,
  "invoice_number": str|null,
  "subtotal": number|null,
  "discount": number|null,
  "delivery_fee": number|null,
  "declared_item_count": number|null,
  "items": [{"description": str, "quantity": number|null, "unit": str|null, "rate": number|null, "amount": number|null}],
  "confidence": float,
  "note": str
}"""

VALIDATION_SYSTEM_PROMPT = """You are validating a previous bill extraction against the original bill (image or text).

Goal: fix MISSING or EXTRA product rows. Prefer the printed Sl No. count when present.

Rules:
- If the bill has Sl No. 1..N, return EXACTLY N items — no duplicates, no invented rows.
- Re-read EVERY product/goods row; copy description EXACTLY as printed (including Gujarati already on the bill).
- Do NOT invent alternate Gujarati/English names. Do NOT rename items (Parvar stays Parvar).
- Do NOT return near-duplicate rows of the same product with tiny description changes.
- If the first pass already has the correct count and only needs description fixes, return that corrected list once.
- Keep grand total (amount) unless clearly wrong.
- missing_count: net rows you believe were missing before (0 if first pass was complete or over-long).
- items_complete: true only if items length matches the bill's row count.

Respond ONLY with JSON in the same schema as extraction, plus:
"missing_count": int,
"items_complete": bool
"""

ITEMS_ONLY_SYSTEM_PROMPT = """You extract ONLY product line items visible in this bill image crop.

Rules:
- Return every product/goods row you can see in THIS crop (partial lists are OK — other crops cover the rest).
- Do NOT invent items not visible here.
- description: copy EXACTLY as printed (Gujarati/Hindi/English; keep typos; no translation).
- Put qty/rate/price only in quantity/unit/rate/amount fields — never inside description.
- Skip headers like "Items in this order", address blocks ("Delivering to"), ads, payment rows, delivery, round-off, Cancel Order.
- If you see text like "Items in this order (22)", set declared_item_count to 22, else null.
- Use the paid/line price (not struck-through MRP) for amount.
- Include items near the bottom of the crop even if partially cut off when the name and price are readable.

Respond ONLY with JSON:
{
  "declared_item_count": number|null,
  "items": [{"description": str, "quantity": number|null, "unit": str|null, "rate": number|null, "amount": number|null}]
}
"""

GAP_FILL_SYSTEM_PROMPT = """You are finding MISSING product rows on a grocery/order bill.

You will see the lower part of a tall order screenshot (end of item list, maybe start of delivery).
A previous extraction is short by a few items. The grand total is already known.

Rules:
- Add ONLY product rows that are printed but missing from the provided list.
- Prefer items near the end of the list (just above "Delivering to" / address).
- description: copy exactly as printed.
- amount: paid line price (not MRP strikethrough).
- Do not invent items. Do not repeat items already listed.
- If amount_gap is provided, the sum of newly added item amounts should preferably equal that gap.

Respond ONLY with JSON:
{
  "missing_items": [{"description": str, "quantity": number|null, "unit": str|null, "rate": number|null, "amount": number|null}],
  "note": str
}
"""

TOTALS_ONLY_SYSTEM_PROMPT = """You extract bill header and payment totals from this bill image (often the bottom of a tall screenshot).

Rules:
- amount: FINAL Grand Total / Total payable only (not MRP Total, not a single item).
- vendor, bill_date (ISO), invoice_number / Order ID, subtotal, discount, delivery_fee.
- declared_item_count: if you see "Items in this order (N)" anywhere in the crop, set N; else null.
- items: [] (empty — items are extracted from other crops).

Respond ONLY with JSON:
{
  "vendor": str|null,
  "amount": number|null,
  "currency": str,
  "bill_date": str|null,
  "invoice_number": str|null,
  "subtotal": number|null,
  "discount": number|null,
  "delivery_fee": number|null,
  "declared_item_count": number|null,
  "items": [],
  "confidence": float,
  "note": str
}
"""


def build_user_prompt(
    *,
    filename: str,
    owner: str,
    category: str,
    text: str | None = None,
) -> str:
    parts = [
        f"Filename: {filename}",
        f"Expense owner: {owner}",
        f"Upload category (from user): {category}",
        "Extract the grand total, vendor, invoice date, and ALL product line items.",
        "If the bill says e.g. Items in this order (22), you must return exactly that many product rows when possible.",
        "For each item description: copy the printed product name exactly (Gujarati/Hindi/English as shown) — do not translate or fix spelling.",
        "Read the full bill: item table/list AND the payment/total section.",
    ]
    if text:
        parts.append("")
        parts.append("Bill text:")
        parts.append(text[:16000])
    return "\n".join(parts)


def build_items_slice_prompt(
    *, filename: str, slice_index: int, slice_count: int
) -> str:
    return "\n".join(
        [
            f"Filename: {filename}",
            f"This is item-list crop {slice_index + 1} of {slice_count}.",
            "Extract EVERY product row visible in this crop only.",
            "Copy product names exactly as printed.",
        ]
    )


def build_gap_fill_prompt(
    *,
    filename: str,
    existing_items: list[dict[str, Any]],
    expected_item_count: int | None,
    amount_gap: float | None,
    grand_total: float | None,
) -> str:
    parts = [
        f"Filename: {filename}",
        f"Already extracted {len(existing_items)} items:",
        json.dumps(existing_items, ensure_ascii=False)[:8000],
    ]
    if expected_item_count is not None:
        parts.append(
            f"Bill declares {expected_item_count} items — need "
            f"{max(0, expected_item_count - len(existing_items))} more."
        )
    if grand_total is not None:
        parts.append(f"Grand total on bill: {grand_total}")
    if amount_gap is not None:
        parts.append(
            f"Sum of extracted item amounts is short of the grand total by about {amount_gap:.2f}. "
            "Find the missing product row(s) whose prices fill that gap."
        )
    parts.append(
        'Look especially at products just above "Delivering to" / the address block.'
    )
    return "\n".join(parts)


def build_totals_slice_prompt(*, filename: str, owner: str, category: str) -> str:
    return "\n".join(
        [
            f"Filename: {filename}",
            f"Expense owner: {owner}",
            f"Upload category (from user): {category}",
            "Extract vendor, order/invoice id, date, and FINAL total from this crop.",
            "Leave items as [].",
        ]
    )


def build_validation_prompt(
    *,
    filename: str,
    first_pass: dict[str, Any],
    text: str | None = None,
    expected_item_count: int | None = None,
) -> str:
    item_count = (
        len(first_pass.get("items") or [])
        if isinstance(first_pass.get("items"), list)
        else 0
    )
    parts = [
        f"Filename: {filename}",
        f"First-pass extraction had {item_count} line item(s).",
        f"First-pass JSON:\n{json.dumps(first_pass, ensure_ascii=False)[:12000]}",
        "Re-check the bill carefully for any product rows missing from items[].",
        "Return the full corrected JSON with a complete items list.",
        "Prefer keeping the first-pass grand total (amount) if it matches the bill.",
    ]
    if expected_item_count is not None:
        parts.append(
            f"The bill declares {expected_item_count} items. "
            f"Current list has {item_count}. Add the missing {max(0, expected_item_count - item_count)} product row(s)."
        )
    if text:
        parts.append("")
        parts.append("Bill text:")
        parts.append(text[:16000])
    return "\n".join(parts)


SMS_SYSTEM_PROMPT = """You extract structured expense data from Indian bank, UPI, or wallet payment SMS messages.

Rules:
- vendor: merchant or payee name as shown in the SMS (short brand name is OK).
- amount: transaction amount debited or paid (number only).
- currency: ISO code, default INR.
- confidence: 0-1 for how sure you are of vendor and amount.
- note: one short line summarizing the transaction type if helpful.

Do NOT extract or infer the transaction date — the user provides the date separately.

Respond ONLY with JSON:
{
  "vendor": str|null,
  "amount": number|null,
  "currency": str,
  "confidence": float,
  "note": str
}"""


def build_sms_prompt(
    *,
    text: str,
    filename: str,
    owner: str,
    category: str,
) -> str:
    return "\n".join(
        [
            f"Filename: {filename}",
            f"Owner: {owner}",
            f"Category: {category}",
            "",
            "SMS message:",
            text[:8000],
        ]
    )
