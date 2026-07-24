"""Sync Drive files and process pending bills."""

from __future__ import annotations

import re
import traceback
from datetime import date

from bill_processor import config
from bill_processor.db.client import DbClient, ExpenseWrite, LineItemWrite
from bill_processor.drive.client import DriveClient
from bill_processor.extractor.router import extract_content
from bill_processor.llm.client import unload_all_models
from bill_processor.llm.runner import extract_bill


def _resolve_sms_bill_date(*, app_bill_date: str | None, filename: str) -> date | None:
    if app_bill_date:
        try:
            return date.fromisoformat(app_bill_date[:10])
        except ValueError:
            pass

    match = re.search(r"sms_(\d{4}-\d{2}-\d{2})", filename)
    if match:
        try:
            return date.fromisoformat(match.group(1))
        except ValueError:
            pass

    return None


def sync_drive_files(drive: DriveClient, db: DbClient) -> tuple[int, int]:
    files = drive.list_bill_files(page_size=500)
    synced_ids: list[str] = []
    for file in files:
        source = "sms" if file.entry_type == "sms" else "drive"
        db.upsert_drive_file(
            drive_file_id=file.drive_file_id,
            filename=file.filename,
            owner=file.owner,
            category=file.category,
            mime_type=file.mime_type,
            web_view_link=file.web_view_link,
            drive_created_at=file.drive_created_at,
            source=source,
        )
        synced_ids.append(file.drive_file_id)
    removed = db.delete_drive_files_not_in(synced_ids) if synced_ids else 0
    return len(files), removed


def process_pending(
    drive: DriveClient,
    db: DbClient,
    *,
    limit: int,
    include_failed: bool = False,
    include_done: bool = False,
    reclaim_stuck: bool = False,
) -> dict[str, int]:
    stats = {"claimed": 0, "done": 0, "failed": 0, "reclaimed": 0}
    stale_minutes = 0 if reclaim_stuck else config.PROCESSOR_STALE_MINUTES
    stats["reclaimed"] = db.reclaim_stuck_processing(stale_minutes=stale_minutes)
    if stats["reclaimed"]:
        print(
            f"Reclaimed {stats['reclaimed']} stuck file(s) from processing → pending."
        )

    batch = db.claim_pending(
        limit,
        include_failed=include_failed,
        include_done=include_done,
    )
    stats["claimed"] = len(batch)

    if batch:
        unload_all_models()

    for row in batch:
        try:
            file_bytes = drive.download_file(row.drive_file_id)
            content = extract_content(
                file_bytes=file_bytes,
                mime_type=row.mime_type,
                filename=row.filename,
            )
            print(
                f"processing  {row.drive_file_id}  {row.filename}  ({row.mime_type}) "
                f"method={content.extraction_method} source={row.source}"
            )
            extraction = extract_bill(
                content=content,
                filename=row.filename,
                owner=row.owner,
                category=row.category,
            )

            bill_date = extraction.bill_date
            raw_llm_json = extraction.raw
            if row.source == "sms" or content.extraction_method == "sms_text":
                meta = drive.get_file(row.drive_file_id)
                bill_date = _resolve_sms_bill_date(
                    app_bill_date=meta.bill_date,
                    filename=row.filename,
                )
                if isinstance(raw_llm_json, dict):
                    raw_llm_json = dict(raw_llm_json)
                    if content.text and "sms_text" not in raw_llm_json:
                        raw_llm_json["sms_text"] = content.text

            unload_all_models()
            db.upsert_expense(
                ExpenseWrite(
                    drive_file_id=row.drive_file_id,
                    owner=row.owner,
                    category=row.category,
                    vendor=extraction.vendor,
                    amount=extraction.amount,
                    currency=extraction.currency,
                    bill_date=bill_date,
                    confidence=extraction.confidence,
                    raw_llm_json=raw_llm_json,
                    invoice_number=extraction.invoice_number,
                    subtotal=extraction.subtotal,
                    discount=extraction.discount,
                    delivery_fee=extraction.delivery_fee,
                    items=tuple(
                        LineItemWrite(
                            description=item.description,
                            quantity=item.quantity,
                            unit=item.unit,
                            rate=item.rate,
                            amount=item.amount,
                        )
                        for item in extraction.items
                    ),
                )
            )
            model_label = f"{extraction.model}:{content.extraction_method}"
            db.mark_done(row.drive_file_id, model=model_label)
            stats["done"] += 1
            print(
                f"done  {row.drive_file_id}  {row.filename}  "
                f"amount={extraction.amount} items={len(extraction.items)} date={bill_date}"
            )
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            try:
                unload_all_models()
            except Exception:
                pass
            db.mark_failed(row.drive_file_id, error=error)
            stats["failed"] += 1
            print(f"failed  {row.drive_file_id}  {row.filename}  {error}")
            traceback.print_exc()

    return stats


def dry_run_preview(db: DbClient, *, limit: int) -> list[str]:
    rows = db.list_pending_preview(limit)
    lines: list[str] = []
    for row in rows:
        lines.append(
            f"{row.process_status:10}  {row.owner:7}  {row.category:20}  {row.filename}"
        )
    return lines
