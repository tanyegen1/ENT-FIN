# Pulse — Investing UI

A trading app front end built as a React + TypeScript + Vite SPA, following
the same interaction patterns and visual language as popular commission-free
brokerage apps: a dark theme, green/red price deltas, a scrubbable price
chart, and a market-order flow driven by a numeric keypad.

It's a **paper-trading practice app** — all money is simulated. Most stock
data is mocked client-side; five tickers pull real live prices (see below).
Accounts and saved portfolios are optional and backed by Supabase (see
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

## Live data (5 tickers only)

AAPL, TSLA, NVDA, COIN, and BTC show real, polled market data — current
price, day change, and the portfolio math derived from them — everywhere
else in the app stays static mock data.

- **BTC** needs no setup: it's fetched from CoinGecko's public API, which
  allows direct browser calls with no key.
- **AAPL / TSLA / NVDA / COIN** need a free [Finnhub](https://finnhub.io/register)
  API key (no card, ~1 minute): paste it into `.env.local` as
  `VITE_FINNHUB_API_KEY=...` (same file as the Supabase keys above), then
  restart `npm run dev`.

Without a key, those four just fall back to the static mock price — the
app still works, the small dot next to the ticker turns amber ("Demo
data") instead of green ("Live") to say so. Quotes poll every 20 seconds.

The published Artifact preview link can't do this either, for the same
sandbox reason as accounts above.

## Stack

- React 19 + TypeScript, Vite build
- Tailwind CSS v4 (dark theme via `@theme` tokens in `src/index.css`)
- `react-router-dom` (`HashRouter`) for routing
- Supabase (`@supabase/supabase-js`) for auth + Postgres persistence — optional
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
- **Search** (`/search`) — live filter across mock stocks/ETFs/crypto.
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
