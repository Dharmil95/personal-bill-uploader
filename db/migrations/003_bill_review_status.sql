-- Bill review status (user can mark bad extractions as invalid)
-- Apply in Supabase SQL Editor after 002_expense_line_items.sql

alter table public.drive_files
  add column if not exists review_status text not null default 'active'
    check (review_status in ('active', 'invalid'));

create index if not exists drive_files_review_status_idx
  on public.drive_files (review_status);
