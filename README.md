# Arvo — Investing UI

A trading app front end built as a React + TypeScript + Vite SPA, following
the same interaction patterns and visual language as popular commission-free
brokerage apps: a dark theme, green/red price deltas, a scrubbable price
chart, and a market-order flow driven by a numeric keypad.

It's a **paper-trading practice app** — all money is simulated. Every stock,
fund, and crypto asset in the app pulls a real, polled market price (see
below) — only the trades themselves are simulated. Accounts and saved
portfolios are optional and backed by Supabase (see
"Accounts & saved data" below) — without it configured, the app runs
entirely locally, no login required.

## Accounts & saved data

Sign up / log in with email + password, and your practice portfolio (cash,
holdings, watchlist, trade and transfer history) is saved to your account
and follows you across devices. There's also **Continue as guest** on the
login screen, which skips accounts entirely and saves to this browser only
(`localStorage`) — the same as how the app behaved before accounts existed.

This needs a free [Supabase](https://supabase.com) project — a real Postgres
database plus auth, all reachable directly from this static app (no custom
server needed). Setup:

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier).
2. **Run the schema**: open your project's SQL Editor and run the contents
   of [`supabase/schema.sql`](supabase/schema.sql) — it creates a
   `portfolios` table with Row Level Security so each user can only ever
   read or write their own row.
3. **Get your keys**: Project Settings → API → copy the Project URL and the
   `anon` public key (this key is *meant* to be public — it's client-safe,
   protected entirely by the RLS policies from step 2, the same model
   Firebase's client config uses).
4. **Set env vars**: `cp .env.example .env.local`, then fill in:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. **Restart** `npm run dev`. Signup and login now work.

**Optional, for faster testing:** Supabase projects require confirming your
email before you can log in by default. To skip that while testing, go to
**Authentication → Providers → Email** in your Supabase dashboard and turn
off **"Confirm email"** — signup then logs you straight in, no inbox check
needed. Leave it on for a real deployment other people will use.

### What won't work where

- **The published Artifact preview link** can't do *any* of this — signup
  and login both require calls to outside APIs, which that sandbox blocks
  entirely (same restriction that blocks live stock prices). It always
  falls back to guest/local mode there.
- **Locally (`npm run dev`)** — everything works once Supabase is configured.
- **A real deployment** (Vercel, Netlify, etc.) — also fully works; just set
  the same env vars in your host's dashboard. (Routing uses `HashRouter`
  — URLs look like `/#/stock/AAPL` — specifically so this also renders
  correctly inside a sandboxed preview iframe, which restricts the browser
  History API `BrowserRouter` needs. `vercel.json` / `public/_redirects`
  are included in case you ever switch to `BrowserRouter` for a real
  deployment, but aren't required as things stand.)

## Live data (every stock in the app)

Every symbol in [`src/data/stocks.ts`](src/data/stocks.ts) — currently 19
stocks/ETFs plus Bitcoin — shows a real, polled market price, day change,
and the portfolio math derived from it. `src/data/liveQuotes.ts` derives the
live-symbol list from that file directly, so a stock added there is
automatically wired up for live quotes too, with no second list to keep in
sync.

- **Bitcoin (BTC)** needs no setup: it's fetched from CoinGecko's public
  API, which allows direct browser calls with no key. Any other crypto
  added later needs its CoinGecko id added to `COINGECKO_IDS` in
  `liveQuotes.ts`.
- **Everything else** (stocks and ETFs) needs a free
  [Finnhub](https://finnhub.io/register) API key (no card, ~1 minute):
  paste it into `.env.local` as `VITE_FINNHUB_API_KEY=...` (same file as
  the Supabase keys above), then restart `npm run dev`.

Without a key, stocks and ETFs just fall back to the static mock price —
the app still works, the small dot next to the ticker turns amber ("Demo
data") instead of green ("Live") to say so.

Quotes poll every 45 seconds. That interval is sized for Finnhub's free
tier — 60 calls/minute — against one call per stock per poll; if you add
enough symbols to `stocks.ts` to approach that limit at 45s, raise `POLL_MS`
in `liveQuotes.ts` rather than polling faster.

The published Artifact preview link can't do this either, for the same
sandbox reason as accounts above.

### Chart history

The main price chart on a stock's page (and the comparison chart against a
benchmark/peer) tries real historical prices from the same two sources
before falling back to a synthetic walk:

- **BTC** — CoinGecko's `market_chart` endpoint, same free/keyless access
  as its live quote.
- **Stocks/ETFs** — Finnhub's `/stock/candle` endpoint, using the same
  `VITE_FINNHUB_API_KEY`. Finnhub's free tier doesn't include candles for
  US stocks on every plan; if a fetch comes back empty or rejected, that
  chart just quietly uses the synthetic walk instead — same fallback
  philosophy as the quotes above, and nothing in the UI claims it's real
  when it isn't.

`src/data/historyApi.ts` holds both fetchers (`fetchRealHistory`), and
`src/data/priceHistory.ts` exports `usePriceHistory` — the hook that shows
the synthetic walk immediately and swaps in real data if the fetch
succeeds, cached per symbol+range for the session. The synthetic fallback
itself is also more accurate now: its "1D" walk is anchored to the stock's
actual previous close (not just its current price), and "YTD" uses the
real number of elapsed days this year instead of a fixed guess.

List-view sparklines (search results, watchlist rows, the home-page
carousel) and the portfolio's aggregate value-over-time chart intentionally
stay on the synthetic walk — fetching real history for every row in a list
at once isn't a good use of a free API's rate limit, and those charts are
illustrative rather than the ones a user is reading closely.

## Nasdaq & NYSE catalogue (full stock universe)

Beyond the 19 curated stocks/ETFs in `src/data/stocks.ts`, the app can search
and open a page for **any active common stock or listed ADR on Nasdaq or
NYSE** — not an index like the Nasdaq-100 or S&P 500, the full exchange
universe. This is a separate backend from the Live data section above: it
runs as Supabase Edge Functions (`supabase/functions/`) calling
[Massive](https://massive.com) (Polygon.io's 2026 rebrand; existing Polygon
API keys still work) for instrument reference data, quotes, historical bars,
and company branding.

**Why a backend at all, instead of calling Massive directly from the
browser like Finnhub above:** Massive's terms (like most market-data
providers) don't permit exposing the API key client-side, and a full
Nasdaq+NYSE catalogue import has to paginate through the entire reference
data set and merge it safely into a shared database — neither fits a
key-in-the-browser, no-server model.

### What works without any setup

Nothing here is required — with no Supabase project configured (or one
configured but without this backend set up), the app behaves exactly as
before: search and stock pages only cover the 19 curated symbols, and no
catalogue UI (the Nasdaq/NYSE exchange filter, catalogue search results
section) appears at all.

### Setup

1. Have a Supabase project already set up (see "Accounts & saved data"
   above) — the catalogue reuses it rather than needing a second one.
2. **Run the schema**: the `supabase/schema.sql` file now also creates the
   `instruments` / `instruments_staging` / `instrument_sync_runs` tables and
   the `activate_instrument_sync` / `search_instruments` functions. Re-run
   the whole file in your SQL Editor (every statement is idempotent).
3. **Deploy the Edge Functions**: `supabase functions deploy catalogue-sync
   catalogue-search quotes bars instrument-details logo-proxy` (requires the
   [Supabase CLI](https://supabase.com/docs/guides/cli)). `logo-proxy` must
   run without JWT verification (it's used directly as an `<img src>`,
   which can't send an Authorization header) — `supabase/config.toml`
   sets that, or pass `--no-verify-jwt` explicitly if your CLI version
   doesn't pick it up.
4. **Set secrets**: in the Supabase dashboard, Edge Functions -> Manage
   secrets, set `MASSIVE_API_KEY`, `MASSIVE_QUOTE_DELAY_SECONDS`, and
   `CATALOGUE_SYNC_SECRET` — see `.env.example` for what each one does.
5. **Run the first sync**: `POST` to your `catalogue-sync` function URL with
   header `x-sync-secret: <your secret>`. A full Nasdaq+NYSE import can take
   more than one invocation's execution-time budget — the function is
   resumable (it returns `{"status":"partial"}` and picks up where it left
   off), so call it again (or schedule it) until it returns
   `{"status":"success"}`. For ongoing freshness, schedule it periodically
   with `pg_cron`, e.g.:
   ```sql
   select cron.schedule(
     'catalogue-sync-daily', '0 11 * * *',
     $$select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/catalogue-sync',
       headers := jsonb_build_object('x-sync-secret', '<your secret>')
     )$$
   );
   ```
6. Restart `npm run dev` (or redeploy) — the catalogue search filter and
   full-universe search results now appear automatically once
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set, no separate client
   flag needed.

### How the catalogue and the curated list relate

- A search result from the catalogue that's **also** one of the 19 curated
  symbols is deduplicated in favor of the curated entry (richer authored
  content — about text, analyst insights, comparisons).
- A catalogue-only result opens a simpler stock page
  (`src/pages/CatalogueStockDetail.tsx`) with real price/chart data, but
  without the curated page's authored "about"/risk copy, analyst outlook,
  or comparisons — those don't exist for a catalogue instrument and are
  never fabricated to fill the gap.
- **Catalogue presence never implies trading eligibility.** Every synced
  instrument starts with `trading_eligible = false`; the practice Buy/Sell
  flow (the same `OrderSheet`/`PriceRuleSheet` components the curated list
  uses — see `src/types.ts`'s `OrderableStock`) only lights up for a
  catalogue instrument once an operator explicitly flips that column to
  `true` for it in the database (after confirming its quote data is
  reliable) — this is a deliberate, conservative default, not a bug.
- Prices are never polled continuously for the whole catalogue — only
  fetched on demand (a search result's visible page, an opened stock page)
  via batched calls, per Massive's rate limits.

### Data rights and coverage — read before enabling this for real users

Whether your specific Massive/Polygon plan permits displaying this data in
a **public, commercial application** (redistribution, exchange
entitlements, attribution requirements) is between you and Massive — check
your plan's terms before enabling this for anyone but yourself. A personal/
developer-tier key is not automatically a public-display license. This
repository's code never assumes otherwise: `MASSIVE_QUOTE_DELAY_SECONDS` is
operator-set specifically so a quote is never labeled "real-time" unless
your plan actually entitles it to be, and nothing here defaults to treating
a key as consolidated-tape or extended-hours-entitled without you saying so.

## Stack

- React 19 + TypeScript, Vite build
- Tailwind CSS v4 (dark theme via `@theme` tokens in `src/index.css`)
- `react-router-dom` (`HashRouter`) for routing
- Supabase (`@supabase/supabase-js`) for auth + Postgres persistence — optional
- Supabase Edge Functions (Deno) + Massive/Polygon.io for the full Nasdaq/NYSE catalogue — optional, see above
- `motion` (Framer Motion) for page transitions, shared-layout animations, and springs
- Hand-rolled SVG charts with pointer-based scrubbing (no charting library)
- `lucide-react` + `simple-icons` for icons and real brand logos

## Pages

- **Login** (`/`, shown when signed out and Supabase is configured) — email/password
  with a login/signup toggle and "Continue as guest".
- **Home** (`/`) — portfolio value, interactive value chart with range
  tabs (1D/1W/1M/3M/YTD/1Y/5Y/ALL), buying power (deposit/withdraw practice
  cash), holdings list, watchlist preview.
- **Stock detail** (`/stock/:symbol`) — price chart, your position, key
  stats, a plain-English Insights section (with S&P 500 / peer comparison),
  about section, and a Buy/Sell order sheet with a keypad, review step, and
  animated confirmation.
- **Search** (`/search`) — live filter across mock stocks/ETFs/crypto, plus
  (when the catalogue backend is configured — see above) server-side search
  across every active Nasdaq/NYSE common stock and ADR, with an All/Nasdaq/
  NYSE filter.
- **Lists** (`/lists`) — watchlist.
- **Account** (`/account`) — profile, sync status, settings rows, reset
  practice portfolio, unified trade + transfer activity feed.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint      # oxlint
```
