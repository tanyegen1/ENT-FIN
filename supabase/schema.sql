-- Run this once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- Stores one row per signed-in user with their full practice-portfolio
-- state as JSON, mirroring the shape already used client-side
-- (see src/types.ts: Holding, OrderRecord, TransferRecord).

create table if not exists public.portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash numeric not null default 4250.32,
  holdings jsonb not null default '[]'::jsonb,
  watchlist jsonb not null default '[]'::jsonb,
  orders jsonb not null default '[]'::jsonb,
  transfers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

-- Each user can only ever see or touch their own row.
create policy "portfolios_select_own" on public.portfolios
  for select using (auth.uid() = user_id);

create policy "portfolios_insert_own" on public.portfolios
  for insert with check (auth.uid() = user_id);

create policy "portfolios_update_own" on public.portfolios
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "portfolios_delete_own" on public.portfolios
  for delete using (auth.uid() = user_id);
