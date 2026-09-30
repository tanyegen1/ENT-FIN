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

-- ---------------------------------------------------------------------------
-- Instrument catalogue (Nasdaq + NYSE common stocks and listed ADRs).
--
-- Populated by the `catalogue-sync` Edge Function from the Massive
-- (formerly Polygon.io) reference-data API — never hand-maintained. Rows
-- here represent instrument *identity* (ticker, name, exchange, security
-- type, branding); live/quote and historical-bar data are fetched on
-- demand by the `quotes` and `bars` Edge Functions and are never stored
-- here, so this table never goes stale in a way that matters for pricing.
--
-- Written only by Edge Functions using the service-role key (which bypasses
-- RLS) — the policies below intentionally grant no anon/authenticated
-- write access. Readable by anyone (it's a public instrument directory, not
-- user data), via the `catalogue-search` Edge Function or directly.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm;

do $$ begin
  create type public.instrument_exchange as enum ('XNAS', 'XNYS', 'XASE', 'ARCX', 'OTHER');
exception when duplicate_object then null;
end $$;

do $$ begin
  -- 'common_stock' covers both ordinary common shares and listed ADRs/ADSs
  -- (Massive/Polygon's own `type` field distinguishes CS from ADRC/ADRR/etc
  -- — see supabase/functions/_shared/massive.ts's classifySecurityType,
  -- which maps that distinction into `is_adr` below rather than a separate
  -- enum value, since an ADR is still traded/settled like a common stock).
  create type public.instrument_security_type as enum
    ('common_stock', 'etf', 'preferred', 'warrant', 'unit', 'right', 'other');
exception when duplicate_object then null;
end $$;

create table if not exists public.instruments (
  -- Stable internal identity — never reassigned, never reused across a
  -- ticker change or a delisted-then-relisted-under-the-same-ticker
  -- situation (those are matched/created by provider_id, not by ticker;
  -- see the sync function).
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'massive',
  -- The provider's own stable identifier for this instrument — Massive's
  -- composite FIGI when available (survives ticker changes), else the
  -- ticker itself as a last resort for instruments the provider doesn't
  -- return a FIGI for.
  provider_id text not null,
  ticker text not null,
  name text not null,
  primary_exchange public.instrument_exchange not null,
  security_type public.instrument_security_type not null,
  is_adr boolean not null default false,
  currency text not null default 'USD',
  active boolean not null default true,
  cik text,
  composite_figi text,
  share_class_figi text,
  website_domain text,
  -- Populated only once branding has been verified against this issuer
  -- (see logo-proxy Edge Function) — never a guessed/searched image.
  logo_url text,
  icon_url text,
  branding_verified boolean not null default false,
  -- Separate from `active`: an instrument can be listed (active) but not
  -- yet eligible for practice trading (e.g. quote data can't be sourced
  -- reliably) — catalogue presence must never imply trading eligibility.
  trading_eligible boolean not null default false,
  extended_hours_eligible boolean not null default false,
  -- Set by instrument-details on every lazy branding-enrichment attempt
  -- (whether or not it found anything) so that a ticker with genuinely no
  -- provider branding isn't re-queried on every single stock-page view —
  -- see _shared/branding.ts's shouldAttemptBrandingEnrichment.
  branding_checked_at timestamptz,
  metadata_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

-- Safe to re-run: adds the column for a database created before it existed.
alter table public.instruments add column if not exists branding_checked_at timestamptz;

create index if not exists instruments_ticker_idx on public.instruments (ticker);
create index if not exists instruments_ticker_prefix_idx on public.instruments (ticker text_pattern_ops);
create index if not exists instruments_name_trgm_idx on public.instruments using gin (name gin_trgm_ops);
create index if not exists instruments_active_idx on public.instruments (active);
create index if not exists instruments_exchange_idx on public.instruments (primary_exchange);
create index if not exists instruments_security_type_idx on public.instruments (security_type);

alter table public.instruments enable row level security;

create policy "instruments_select_all" on public.instruments
  for select using (true);

-- Staging table for the staged/safe import (spec section 3): a sync run
-- writes every page it fetches here first. Only once pagination completes
-- in full does the sync function copy staging -> instruments inside one
-- transaction; a failed or partial fetch leaves `instruments` completely
-- untouched, never partially wiped. Truncated at the start of each run.
create table if not exists public.instruments_staging (
  id uuid,
  provider text not null default 'massive',
  provider_id text not null,
  ticker text not null,
  name text not null,
  primary_exchange public.instrument_exchange not null,
  security_type public.instrument_security_type not null,
  is_adr boolean not null default false,
  currency text not null default 'USD',
  active boolean not null default true,
  cik text,
  composite_figi text,
  share_class_figi text,
  website_domain text,
  logo_url text,
  icon_url text,
  branding_verified boolean not null default false,
  metadata_updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

alter table public.instruments_staging enable row level security;
-- No policies: service-role only (bypasses RLS) — this is sync-run scratch
-- space, never read by the client.

-- One row per catalogue-sync attempt — the audit trail behind "source and
-- time of the latest successful full sync" and "actual imported counts by
-- exchange and security type" in the delivery report. Service-role only;
-- the catalogue-sync function returns its own run's summary in its HTTP
-- response rather than requiring clients to query this table.
create table if not exists public.instrument_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'massive',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'partial', 'success', 'failed')),
  pages_fetched integer not null default 0,
  instruments_seen integer not null default 0,
  instruments_activated integer not null default 0,
  instruments_deactivated integer not null default 0,
  counts_by_exchange jsonb,
  counts_by_security_type jsonb,
  error text,
  -- Full Nasdaq+NYSE reference-data pagination can exceed one Edge
  -- Function invocation's execution-time budget. A 'partial' run persists
  -- exactly where it left off here (remaining exchange/type combinations
  -- still to fetch, and the pagination cursor mid-combination, if any) so
  -- the next invocation resumes rather than restarting — the live
  -- `instruments` table is only ever touched once every combination has
  -- completed across however many invocations that took.
  resume_state jsonb
);

alter table public.instrument_sync_runs enable row level security;
-- No policies: service-role only.

-- Called by catalogue-sync at the start of a fresh (non-resumed) run.
create or replace function public.truncate_instruments_staging()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table public.instruments_staging;
$$;

-- Called by catalogue-sync only once every exchange/type combination has
-- paginated to completion in the same run (possibly across several
-- resumed invocations) — see instrument_sync_runs.resume_state. Merges
-- instruments_staging into the live instruments table in one transaction
-- (upsert identity fields only, never touching branding/eligibility
-- columns a separate enrichment step may have set), then marks anything
-- previously active that this run's staging data no longer contains as
-- inactive (a delisting) — never deletes a row, preserving historical
-- records referenced by portfolios/orders.
create or replace function public.activate_instrument_sync(p_provider text)
returns table (
  activated integer,
  deactivated integer,
  counts_by_exchange jsonb,
  counts_by_security_type jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upserted integer;
  v_deactivated integer;
begin
  insert into public.instruments (
    id, provider, provider_id, ticker, name, primary_exchange, security_type,
    is_adr, currency, active, cik, composite_figi, share_class_figi, metadata_updated_at
  )
  select
    coalesce(i.id, gen_random_uuid()), s.provider, s.provider_id, s.ticker, s.name,
    s.primary_exchange, s.security_type, s.is_adr, s.currency, s.active,
    s.cik, s.composite_figi, s.share_class_figi, now()
  from public.instruments_staging s
  left join public.instruments i on i.provider = s.provider and i.provider_id = s.provider_id
  where s.provider = p_provider
  on conflict (provider, provider_id) do update set
    ticker = excluded.ticker,
    name = excluded.name,
    primary_exchange = excluded.primary_exchange,
    security_type = excluded.security_type,
    is_adr = excluded.is_adr,
    currency = excluded.currency,
    active = excluded.active,
    cik = excluded.cik,
    composite_figi = excluded.composite_figi,
    share_class_figi = excluded.share_class_figi,
    metadata_updated_at = now();

  get diagnostics v_upserted = row_count;

  with deactivated as (
    update public.instruments
    set active = false, metadata_updated_at = now()
    where provider = p_provider
      and active = true
      and provider_id not in (select provider_id from public.instruments_staging where provider = p_provider)
    returning 1
  )
  select count(*) into v_deactivated from deactivated;

  return query
  select
    v_upserted,
    v_deactivated,
    (select jsonb_object_agg(primary_exchange, cnt) from (
      select primary_exchange, count(*) cnt from public.instruments
      where provider = p_provider and active = true group by primary_exchange
    ) t),
    (select jsonb_object_agg(security_type, cnt) from (
      select security_type, count(*) cnt from public.instruments
      where provider = p_provider and active = true group by security_type
    ) t);
end;
$$;

-- Backs the catalogue-search Edge Function — one search experience across
-- every modeled exchange (spec section 4), ranked exact-ticker first, then
-- ticker-prefix, then name match. Runs server-side against the indexed
-- `instruments` table so the client never downloads the full catalogue to
-- filter it locally.
create or replace function public.search_instruments(
  p_query text,
  p_exchange text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  ticker text,
  name text,
  primary_exchange text,
  security_type text,
  is_adr boolean,
  currency text,
  active boolean,
  logo_url text,
  icon_url text,
  branding_verified boolean,
  trading_eligible boolean,
  extended_hours_eligible boolean,
  rank int
)
language sql
stable
as $$
  select
    i.id, i.ticker, i.name, i.primary_exchange::text, i.security_type::text, i.is_adr,
    i.currency, i.active, i.logo_url, i.icon_url, i.branding_verified,
    i.trading_eligible, i.extended_hours_eligible,
    case
      when upper(i.ticker) = upper(p_query) then 0
      when i.ticker ilike p_query || '%' then 1
      when i.name ilike p_query || '%' then 2
      else 3
    end as rank
  from public.instruments i
  where i.active = true
    and (p_exchange is null or i.primary_exchange::text = p_exchange)
    and (i.ticker ilike p_query || '%' or i.name ilike '%' || p_query || '%')
  order by rank, i.name asc
  limit p_limit offset p_offset;
$$;
