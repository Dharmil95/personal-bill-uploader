-- Expense source (Drive bill upload vs SMS .txt)
-- Apply in Supabase SQL Editor after 003_bill_review_status.sql

alter table public.drive_files
  add column if not exists source text not null default 'drive'
    check (source in ('drive', 'sms'));

create index if not exists drive_files_source_idx
  on public.drive_files (source);
