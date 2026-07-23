"""Supabase Postgres client for drive_files and expenses."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.rows import dict_row

from bill_processor import config


@dataclass(frozen=True)
class DriveFileRow:
    drive_file_id: str
    filename: str
    owner: str
    category: str
    mime_type: str | None
    web_view_link: str | None
    drive_created_at: datetime | None
    process_status: str


@dataclass(frozen=True)
class LineItemWrite:
    description: str
    quantity: Decimal | None
    unit: str | None
    rate: Decimal | None
    amount: Decimal | None


@dataclass(frozen=True)
class ExpenseWrite:
    drive_file_id: str
    owner: str
    category: str
    vendor: str | None
    amount: Decimal | None
    currency: str
    bill_date: date | None
    confidence: float | None
    raw_llm_json: dict[str, Any]
    invoice_number: str | None = None
    subtotal: Decimal | None = None
    discount: Decimal | None = None
    delivery_fee: Decimal | None = None
    items: tuple[LineItemWrite, ...] = ()


class DbClient:
    def __init__(self) -> None:
        conninfo = config.get_database_conninfo()
        try:
            self._conn = psycopg.connect(conninfo, row_factory=dict_row, connect_timeout=15)
        except psycopg.OperationalError as exc:
            message = str(exc)
            if "Network is unreachable" in message or "No address associated with hostname" in message:
                raise RuntimeError(
                    f"Could not connect to Supabase Postgres: {message}\n\n"
                    f"{config.SUPABASE_DIRECT_HOST_HELP}"
                ) from exc
            raise

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> DbClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def upsert_drive_file(
        self,
        *,
        drive_file_id: str,
        filename: str,
        owner: str,
        category: str,
        mime_type: str | None,
        web_view_link: str | None,
        drive_created_at: datetime | None,
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into public.drive_files (
                  drive_file_id, filename, owner, category, mime_type,
                  web_view_link, drive_created_at, process_status
                ) values (
                  %(drive_file_id)s, %(filename)s, %(owner)s, %(category)s, %(mime_type)s,
                  %(web_view_link)s, %(drive_created_at)s, 'pending'
                )
                on conflict (drive_file_id) do update set
                  filename = excluded.filename,
                  owner = excluded.owner,
                  category = excluded.category,
                  mime_type = excluded.mime_type,
                  web_view_link = excluded.web_view_link,
                  drive_created_at = excluded.drive_created_at,
                  updated_at = timezone('utc', now())
                """,
                {
                    "drive_file_id": drive_file_id,
                    "filename": filename,
                    "owner": owner,
                    "category": category,
                    "mime_type": mime_type,
                    "web_view_link": web_view_link,
                    "drive_created_at": drive_created_at,
                },
            )
        self._conn.commit()

    def reclaim_stuck_processing(self, *, stale_minutes: int | None = None) -> int:
        """Reset interrupted jobs stuck in processing back to pending."""
        minutes = config.PROCESSOR_STALE_MINUTES if stale_minutes is None else stale_minutes
        with self._conn.cursor() as cur:
            if minutes <= 0:
                cur.execute(
                    """
                    update public.drive_files
                    set process_status = 'pending',
                        error = null,
                        updated_at = timezone('utc', now())
                    where process_status = 'processing'
                    returning drive_file_id
                    """
                )
            else:
                cur.execute(
                    """
                    update public.drive_files
                    set process_status = 'pending',
                        error = null,
                        updated_at = timezone('utc', now())
                    where process_status = 'processing'
                      and updated_at < timezone('utc', now()) - make_interval(mins => %(minutes)s)
                    returning drive_file_id
                    """,
                    {"minutes": minutes},
                )
            rows = cur.fetchall()
        self._conn.commit()
        return len(rows)

    def claim_pending(
        self,
        limit: int,
        *,
        include_failed: bool = False,
        include_done: bool = False,
    ) -> list[DriveFileRow]:
        statuses = ["pending"]
        if include_failed:
            statuses.append("failed")
        if include_done:
            statuses.append("done")
        with self._conn.cursor() as cur:
            cur.execute(
                """
                with candidates as (
                  select drive_file_id
                  from public.drive_files
                  where process_status = any(%(statuses)s)
                  order by drive_created_at asc nulls last, created_at asc
                  limit %(limit)s
                  for update skip locked
                )
                update public.drive_files df
                set process_status = 'processing',
                    error = null,
                    updated_at = timezone('utc', now())
                from candidates c
                where df.drive_file_id = c.drive_file_id
                returning df.drive_file_id, df.filename, df.owner, df.category,
                          df.mime_type, df.web_view_link, df.drive_created_at, df.process_status
                """,
                {"statuses": statuses, "limit": limit},
            )
            rows = cur.fetchall()
        self._conn.commit()
        return [
            DriveFileRow(
                drive_file_id=row["drive_file_id"],
                filename=row["filename"],
                owner=row["owner"],
                category=row["category"],
                mime_type=row["mime_type"],
                web_view_link=row["web_view_link"],
                drive_created_at=row["drive_created_at"],
                process_status=row["process_status"],
            )
            for row in rows
        ]

    def mark_done(self, drive_file_id: str, *, model: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update public.drive_files
                set process_status = 'done',
                    processed_at = timezone('utc', now()),
                    model = %(model)s,
                    error = null,
                    updated_at = timezone('utc', now())
                where drive_file_id = %(drive_file_id)s
                """,
                {"drive_file_id": drive_file_id, "model": model},
            )
        self._conn.commit()

    def mark_failed(self, drive_file_id: str, *, error: str) -> None:
        truncated = error[:2000]
        with self._conn.cursor() as cur:
            cur.execute(
                """
                update public.drive_files
                set process_status = 'failed',
                    processed_at = timezone('utc', now()),
                    error = %(error)s,
                    updated_at = timezone('utc', now())
                where drive_file_id = %(drive_file_id)s
                """,
                {"drive_file_id": drive_file_id, "error": truncated},
            )
        self._conn.commit()

    def upsert_expense(self, expense: ExpenseWrite) -> str:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into public.expenses (
                  drive_file_id, owner, category, vendor, amount, currency,
                  bill_date, confidence, raw_llm_json,
                  invoice_number, subtotal, discount, delivery_fee
                ) values (
                  %(drive_file_id)s, %(owner)s, %(category)s, %(vendor)s, %(amount)s,
                  %(currency)s, %(bill_date)s, %(confidence)s, %(raw_llm_json)s::jsonb,
                  %(invoice_number)s, %(subtotal)s, %(discount)s, %(delivery_fee)s
                )
                on conflict (drive_file_id) do update set
                  owner = excluded.owner,
                  category = excluded.category,
                  vendor = excluded.vendor,
                  amount = excluded.amount,
                  currency = excluded.currency,
                  bill_date = excluded.bill_date,
                  confidence = excluded.confidence,
                  raw_llm_json = excluded.raw_llm_json,
                  invoice_number = excluded.invoice_number,
                  subtotal = excluded.subtotal,
                  discount = excluded.discount,
                  delivery_fee = excluded.delivery_fee,
                  updated_at = timezone('utc', now())
                returning id
                """,
                {
                    "drive_file_id": expense.drive_file_id,
                    "owner": expense.owner,
                    "category": expense.category,
                    "vendor": expense.vendor,
                    "amount": expense.amount,
                    "currency": expense.currency,
                    "bill_date": expense.bill_date,
                    "confidence": expense.confidence,
                    "raw_llm_json": json.dumps(expense.raw_llm_json),
                    "invoice_number": expense.invoice_number,
                    "subtotal": expense.subtotal,
                    "discount": expense.discount,
                    "delivery_fee": expense.delivery_fee,
                },
            )
            expense_id = str(cur.fetchone()["id"])

            cur.execute(
                "delete from public.expense_line_items where expense_id = %(expense_id)s",
                {"expense_id": expense_id},
            )

            for index, item in enumerate(expense.items, start=1):
                cur.execute(
                    """
                    insert into public.expense_line_items (
                      expense_id, drive_file_id, line_no, description,
                      quantity, unit, rate, amount
                    ) values (
                      %(expense_id)s, %(drive_file_id)s, %(line_no)s, %(description)s,
                      %(quantity)s, %(unit)s, %(rate)s, %(amount)s
                    )
                    """,
                    {
                        "expense_id": expense_id,
                        "drive_file_id": expense.drive_file_id,
                        "line_no": index,
                        "description": item.description,
                        "quantity": item.quantity,
                        "unit": item.unit,
                        "rate": item.rate,
                        "amount": item.amount,
                    },
                )
        self._conn.commit()
        return expense_id

    def count_by_status(self) -> dict[str, int]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select process_status, count(*) as count
                from public.drive_files
                group by process_status
                """
            )
            rows = cur.fetchall()
        return {row["process_status"]: row["count"] for row in rows}

    def list_pending_preview(self, limit: int) -> list[DriveFileRow]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select drive_file_id, filename, owner, category, mime_type,
                       web_view_link, drive_created_at, process_status
                from public.drive_files
                where process_status in ('pending', 'failed')
                order by drive_created_at asc nulls last, created_at asc
                limit %(limit)s
                """,
                {"limit": limit},
            )
            rows = cur.fetchall()
        return [
            DriveFileRow(
                drive_file_id=row["drive_file_id"],
                filename=row["filename"],
                owner=row["owner"],
                category=row["category"],
                mime_type=row["mime_type"],
                web_view_link=row["web_view_link"],
                drive_created_at=row["drive_created_at"],
                process_status=row["process_status"],
            )
            for row in rows
        ]
