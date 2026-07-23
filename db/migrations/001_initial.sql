-- Bill Uploader initial schema
-- Apply in Supabase SQL Editor or via psql against DATABASE_URL

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.drive_files (
  drive_file_id text primary key,
  filename text not null,
  owner text not null check (owner in ('me', 'parents')),
  category text not null,
  mime_type text,
  web_view_link text,
  drive_created_at timestamptz,
  process_status text not null default 'pending'
    check (process_status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  processed_at timestamptz,
  error text,
  model text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique references public.drive_files (drive_file_id) on delete cascade,
  owner text not null check (owner in ('me', 'parents')),
  category text not null,
  vendor text,
  amount numeric(12, 2),
  currency text not null default 'INR',
  bill_date date,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  raw_llm_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists drive_files_process_status_idx
  on public.drive_files (process_status);

create index if not exists drive_files_owner_idx
  on public.drive_files (owner);

create index if not exists drive_files_category_idx
  on public.drive_files (category);

create index if not exists drive_files_drive_created_at_idx
  on public.drive_files (drive_created_at desc);

create index if not exists expenses_owner_idx
  on public.expenses (owner);

create index if not exists expenses_category_idx
  on public.expenses (category);

create index if not exists expenses_bill_date_idx
  on public.expenses (bill_date desc);

create index if not exists expenses_created_at_idx
  on public.expenses (created_at desc);

drop trigger if exists drive_files_set_updated_at on public.drive_files;
create trigger drive_files_set_updated_at
before update on public.drive_files
for each row
execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

alter table public.drive_files enable row level security;
alter table public.expenses enable row level security;

-- No anon/authenticated policies yet. Server-side service role bypasses RLS.
