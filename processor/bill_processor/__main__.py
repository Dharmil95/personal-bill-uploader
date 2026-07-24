"""CLI entry point for the bill processor."""

from __future__ import annotations

import argparse
import sys

from bill_processor import config
from bill_processor.db.client import DbClient
from bill_processor.drive.client import DriveClient
from bill_processor.pipeline import dry_run_preview, process_pending, sync_drive_files


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sync bill-uploader Drive files and extract expenses via Ollama.",
    )
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Only sync Drive metadata into drive_files; do not process.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Sync Drive metadata, then show pending/failed files (no LLM extraction).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=config.BATCH_LIMIT,
        help=f"Max files to process per run (default: {config.BATCH_LIMIT})",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Include failed files when claiming work.",
    )
    parser.add_argument(
        "--reprocess",
        action="store_true",
        help="Also re-run files already marked done (to refresh totals/line items).",
    )
    parser.add_argument(
        "--reclaim-stuck",
        action="store_true",
        help="Reset all processing files to pending before claiming (use after a crash).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.dry_run:
        drive = DriveClient()
        with DbClient() as db:
            synced, removed = sync_drive_files(drive, db)
            print(f"Synced {synced} Drive file(s) (metadata only).")
            if removed:
                print(f"Removed {removed} stale DB row(s) no longer in Drive.")
            lines = dry_run_preview(db, limit=args.limit)
            if not lines:
                print("No pending or failed files.")
                return 0
            print("Would process:")
            for line in lines:
                print(line)
            counts = db.count_by_status()
            print("\nStatus counts:", counts)
        return 0

    drive = DriveClient()
    with DbClient() as db:
        synced, removed = sync_drive_files(drive, db)
        print(f"Synced {synced} Drive file(s).")
        if removed:
            print(f"Removed {removed} stale DB row(s) no longer in Drive.")

        if args.sync_only:
            print("Status counts:", db.count_by_status())
            return 0

        stats = process_pending(
            drive,
            db,
            limit=args.limit,
            include_failed=args.retry_failed,
            include_done=args.reprocess,
            reclaim_stuck=args.reclaim_stuck,
        )
        reclaimed = stats.get("reclaimed", 0)
        print(
            f"Processed batch: reclaimed={reclaimed} claimed={stats['claimed']} "
            f"done={stats['done']} failed={stats['failed']}"
        )
        print("Status counts:", db.count_by_status())

    return 0


if __name__ == "__main__":
    sys.exit(main())
