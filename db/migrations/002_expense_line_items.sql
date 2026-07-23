-- Expense line items (one row per product/line on a bill)
-- Apply in Supabase SQL Editor after 001_initial.sql

create table if not exists public.expense_line_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  drive_file_id text not null references public.drive_files (drive_file_id) on delete cascade,
  line_no integer not null default 1,
  description text not null,
  quantity numeric(12, 3),
  unit text,
  rate numeric(12, 2),
  amount numeric(12, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (expense_id, line_no)
);

create index if not exists expense_line_items_expense_id_idx
  on public.expense_line_items (expense_id);

create index if not exists expense_line_items_drive_file_id_idx
  on public.expense_line_items (drive_file_id);

drop trigger if exists expense_line_items_set_updated_at on public.expense_line_items;
create trigger expense_line_items_set_updated_at
before update on public.expense_line_items
for each row
execute function public.set_updated_at();

alter table public.expense_line_items enable row level security;

-- Optional bill-level money fields on expenses (totals stay on expenses.amount)
alter table public.expenses
  add column if not exists invoice_number text,
  add column if not exists subtotal numeric(12, 2),
  add column if not exists discount numeric(12, 2),
  add column if not exists delivery_fee numeric(12, 2);
