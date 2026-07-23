"""Sync Drive files and process pending bills."""

from __future__ import annotations

import traceback

from bill_processor import config
from bill_processor.db.client import DbClient, ExpenseWrite, LineItemWrite
from bill_processor.drive.client import DriveClient
from bill_processor.extractor.router import extract_content
from bill_processor.llm.client import unload_all_models
from bill_processor.llm.runner import extract_bill


def sync_drive_files(drive: DriveClient, db: DbClient) -> int:
    files = drive.list_bill_files(page_size=500)
    for file in files:
        db.upsert_drive_file(
            drive_file_id=file.drive_file_id,
            filename=file.filename,
            owner=file.owner,
            category=file.category,
            mime_type=file.mime_type,
            web_view_link=file.web_view_link,
            drive_created_at=file.drive_created_at,
        )
    return len(files)


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
        print(f"Reclaimed {stats['reclaimed']} stuck file(s) from processing → pending.")

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
                f"method={content.extraction_method}"
            )
            extraction = extract_bill(
                content=content,
                filename=row.filename,
                owner=row.owner,
                category=row.category,
            )
            unload_all_models()
            db.upsert_expense(
                ExpenseWrite(
                    drive_file_id=row.drive_file_id,
                    owner=row.owner,
                    category=row.category,
                    vendor=extraction.vendor,
                    amount=extraction.amount,
                    currency=extraction.currency,
                    bill_date=extraction.bill_date,
                    confidence=extraction.confidence,
                    raw_llm_json=extraction.raw,
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
                f"amount={extraction.amount} items={len(extraction.items)}"
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
