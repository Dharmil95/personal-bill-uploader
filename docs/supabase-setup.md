# Supabase setup

This project uses Supabase Postgres to track bill processing status and structured expense data extracted by the local Python job.

Google Drive remains the source of truth for original bill files.

## Schema

Migration files:

| File | Purpose |
|------|---------|
| [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql) | `drive_files` + `expenses` |
| [`db/migrations/002_expense_line_items.sql`](../db/migrations/002_expense_line_items.sql) | `expense_line_items` + bill money fields |
| [`db/migrations/003_bill_review_status.sql`](../db/migrations/003_bill_review_status.sql) | `drive_files.review_status` for invalid bills |
| [`db/migrations/004_expense_source.sql`](../db/migrations/004_expense_source.sql) | `drive_files.source` (`drive` or `sms`) |

Tables:

| Table | Purpose |
|-------|---------|
| `drive_files` | Ledger of Drive files, processing status, and user review status |
| `expenses` | One row per bill (vendor, grand total, date, discount, etc.) |
| `expense_line_items` | Product/line rows for each bill |

## Apply the migration

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Paste the contents of [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql).
4. Click **Run**.
5. Repeat for [`002_expense_line_items.sql`](../db/migrations/002_expense_line_items.sql), [`003_bill_review_status.sql`](../db/migrations/003_bill_review_status.sql), and [`004_expense_source.sql`](../db/migrations/004_expense_source.sql).

## Environment variables

Copy values from **Project Settings → API** and **Database**.

Local `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Session pooler (recommended for local/WSL and the Python processor)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Important:** Do not use the direct connection string (`db.[ref].supabase.co:5432`) for the local processor on WSL — it is IPv6-only and will fail with "Network is unreachable". Copy the **Session pooler** URI from Supabase instead.

Vercel (**Settings → Environment Variables**):

| Variable | Where used |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard API routes (Supabase client path) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Future client-safe access only |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard on Vercel (preferred) |
| `DATABASE_URL` | Local dashboard fallback + Python processor |

For local development, the Dashboard can use either `SUPABASE_SERVICE_ROLE_KEY` or your existing `DATABASE_URL` (Session pooler). On Vercel, set `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings → API → service_role** (or the `sb_secret_...` secret key).

Future local processor `.env`:

| Variable | Where used |
|----------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` | Python job writes processing results |

Security notes:

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit it to git.
- Keep real secrets in `.env` locally and in Vercel env settings only.
- RLS is enabled with no public policies; trusted server code uses the service role.

## Verification queries

Run these in the SQL Editor after migration.

Insert a test drive file:

```sql
insert into public.drive_files (
  drive_file_id,
  filename,
  owner,
  category,
  mime_type,
  process_status
) values (
  'test-drive-file-id',
  'groceries_2026-07-23_sample.jpg',
  'me',
  'Groceries',
  'image/jpeg',
  'pending'
);
```

Insert a matching expense:

```sql
insert into public.expenses (
  drive_file_id,
  owner,
  category,
  vendor,
  amount,
  currency,
  bill_date,
  confidence,
  raw_llm_json
) values (
  'test-drive-file-id',
  'me',
  'Groceries',
  'Sample Mart',
  1250.00,
  'INR',
  '2026-07-23',
  0.910,
  '{"vendor":"Sample Mart","amount":1250,"currency":"INR"}'::jsonb
);
```

Confirm invalid owner is rejected:

```sql
insert into public.drive_files (drive_file_id, filename, owner, category)
values ('bad-owner', 'sample.jpg', 'invalid', 'Groceries');
```

Confirm orphan expense is rejected:

```sql
insert into public.expenses (drive_file_id, owner, category, amount)
values ('missing-drive-id', 'me', 'Groceries', 100);
```

Clean up test data:

```sql
delete from public.expenses where drive_file_id = 'test-drive-file-id';
delete from public.drive_files where drive_file_id = 'test-drive-file-id';
```

## Dashboard API

The Next.js app exposes authenticated dashboard routes that read Supabase via the service role:

| Route | Purpose |
|-------|---------|
| `GET /api/dashboard/summary?owner=me\|parents\|everyone` | Spend totals, category/vendor breakdowns, processor status, and bills list |
| `GET /api/dashboard/expenses/[id]` | One expense with line items and Drive link |

The **Dashboard** tab in the app uses these routes. On Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Locally, `DATABASE_URL` is enough if the service role key is not set yet.

Invalid bills (`review_status = invalid`) are excluded from spend totals but still appear in the bills list with an **Invalid** badge.

## Bill management API

Authenticated routes for deleting bills and marking bad extractions:

| Route | Purpose |
|-------|---------|
| `DELETE /api/bills/[driveFileId]` | Move file to Google Drive trash and delete Supabase rows (cascade) |
| `PATCH /api/bills/[driveFileId]` | Body `{ "reviewStatus": "invalid" \| "active" }` — exclude or restore in dashboard stats |

## What comes next

1. Set up the local processor — see [processor-setup.md](./processor-setup.md).
2. Upload bills, run the processor, and review spend in the Dashboard tab.
