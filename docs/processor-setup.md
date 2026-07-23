# Bill processor setup

Local Python job that syncs bill-uploader files from Google Drive, extracts expense data via Ollama, and writes results to Supabase.

See also: [supabase-setup.md](./supabase-setup.md) for database schema and verification queries.

## Prerequisites

- Python 3.11+
- [Ollama](https://ollama.com/) running locally (`ollama serve`)
- Repo-root `.env` with Google Drive + Supabase credentials (same as the Next.js app)
- Supabase migrations applied:
  - [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql)
  - [`db/migrations/002_expense_line_items.sql`](../db/migrations/002_expense_line_items.sql)

## Install

```bash
cd processor
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Pull Ollama model

One multimodal model handles both text PDFs and images:

```bash
ollama pull gemma4:12b
```

Override with `PROCESSOR_MODEL` in `.env` if you use a different model.

## Environment variables

Add to repo-root `.env` (see [`.env.example`](../.env.example)):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | yes | — | Drive OAuth (shared with Next.js) |
| `GOOGLE_CLIENT_SECRET` | yes | — | Drive OAuth |
| `GOOGLE_REFRESH_TOKEN` | yes | — | Drive OAuth |
| `DATABASE_URL` | yes | — | Supabase **Session pooler** URI (port 6543) |
| `DATABASE_POOLER_URL` | no | — | Optional processor override; takes precedence over `DATABASE_URL` |
| `OLLAMA_HOST` | no | `http://localhost:11434` | Ollama API base URL |
| `PROCESSOR_MODEL` | no | `gemma4:12b` | Multimodal model for PDF text + images |
| `PROCESSOR_VALIDATE` | no | `1` | Final Gemma pass to catch missing line items (`0` to disable) |
| `PROCESSOR_CHUNKED_ITEMS` | no | `1` | Tall screenshots: extract items per slice then merge |
| `PROCESSOR_MAX_ITEM_SLICES` | no | `8` | Max item-list crops for tall screenshots |
| `PROCESSOR_LLM_MODEL` | no | same as `PROCESSOR_MODEL` | Optional text-only override |
| `PROCESSOR_VISION_MODEL` | no | same as `PROCESSOR_MODEL` | Optional vision-only override |
| `PROCESSOR_LLM_TIMEOUT` | no | `300` | Request timeout (seconds) |
| `PROCESSOR_BATCH_LIMIT` | no | `1` | Max files per run (keep at 1 for large vision models) |
| `PROCESSOR_PDF_MIN_TEXT_CHARS` | no | `80` | Below this, PDF pages render for vision |
| `PROCESSOR_VISION_MAX_SIDE` | no | `1280` | Max image edge (px) before vision |
| `PROCESSOR_NUM_CTX` | no | `4096` | Ollama context window |

## Usage

Run from `processor/` with venv activated (loads repo-root `.env` automatically):

```bash
# Preview pending work (syncs Drive metadata first, no LLM extraction)
python -m bill_processor --dry-run

# Sync Drive metadata into drive_files, then process up to 10 pending files
python -m bill_processor

# Sync only (no extraction)
python -m bill_processor --sync-only

# Process one file at a time (recommended with gemma4:12b)
python -m bill_processor --limit 1

# Retry previously failed files
python -m bill_processor --limit 1 --retry-failed

# Re-extract bills already marked done (refresh totals + line items)
python -m bill_processor --limit 1 --reprocess
```

## Processing flow

1. **Sync** — list Drive files with `appProperties source=bill-uploader`, upsert into `drive_files` as `pending` (existing `done` rows are not reset unless `--reprocess`).
2. **Claim** — atomically mark `pending` (or `failed` / `done` with flags) as `processing`.
3. **Download** — fetch file bytes from Drive.
4. **Extract** — route by mime type:
   - Images → Ollama vision (tall screenshots are sliced so totals are not lost)
   - PDF with text → Ollama chat on extracted text
   - Scanned PDF (little text) → PyMuPDF render pages → Ollama vision
5. **Write** — upsert `expenses` (bill header), replace `expense_line_items`, mark `drive_files` as `done` or `failed`.

By default (`PROCESSOR_VALIDATE=1`) each file gets **two** Gemma calls: extract, then validate/fill missing line items. The first-pass grand total is preferred when it looks correct. Set `PROCESSOR_VALIDATE=0` to skip the second pass (faster, fewer VRAM cycles).

Category and owner come from Drive upload metadata, not from the LLM.

## Verify results

After processing, run in Supabase SQL Editor:

```sql
select drive_file_id, filename, process_status, model, error
from public.drive_files
order by updated_at desc
limit 20;

select drive_file_id, vendor, amount, currency, bill_date, invoice_number,
       subtotal, discount, delivery_fee, confidence
from public.expenses
order by created_at desc
limit 20;

select e.vendor, li.line_no, li.description, li.quantity, li.unit, li.rate, li.amount
from public.expense_line_items li
join public.expenses e on e.id = li.expense_id
order by e.created_at desc, li.line_no
limit 100;
```
## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Failed to reach Ollama` | Start Ollama: `ollama serve` |
| `Google Drive credentials missing` | Set Google vars in repo-root `.env` |
| `DATABASE_URL is not set` | Copy Session pooler URI from Supabase dashboard |
| `Network is unreachable` / IPv6 error | Replace direct `db.*.supabase.co:5432` with Session pooler `:6543` URI |
| PDF fails with no text and no pages | File may be corrupt or encrypted; password-protected PDFs are not supported in v1 |
| Model not found | Run `ollama pull <model-name>` for your configured models |

## What comes next

1. Dashboard tab and `/api/dashboard/*` routes reading Supabase
2. Optional upload hook to insert `drive_files` on upload (processor currently discovers via Drive sync)
