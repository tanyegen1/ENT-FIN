# Pulse — Investing UI

A trading app front end built as a React + TypeScript + Vite SPA, following
the same interaction patterns and visual language as popular commission-free
brokerage apps: a dark theme, green/red price deltas, a scrubbable price
chart, and a market-order flow driven by a numeric keypad.

Most data is mocked client-side — there is no backend or real brokerage.
Portfolio state (cash, holdings, watchlist, order history) lives in React
context and persists to `localStorage`. Five tickers (AAPL, TSLA, NVDA,
COIN, BTC) are the exception — see below.

## Live data (5 tickers only)

AAPL, TSLA, NVDA, COIN, and BTC show real, polled market data — current
price, day change, and the portfolio math derived from them — everywhere
else in the app stays static mock data.

- **BTC** needs no setup: it's fetched from CoinGecko's public API, which
  allows direct browser calls with no key.
- **AAPL / TSLA / NVDA / COIN** need a free [Finnhub](https://finnhub.io/register)
  API key (no card, ~1 minute):
  1. `cp .env.example .env.local`
  2. Paste your key into `.env.local` as `VITE_FINNHUB_API_KEY=...`
  3. Restart `npm run dev`

Without a key, those four just fall back to the static mock price — the
app still works, the small dot next to the ticker turns amber ("Demo
data") instead of green ("Live") to say so. Quotes poll every 20 seconds.

The published Artifact preview link can't do any of this — its sandbox
blocks calls to outside APIs entirely — so live data only shows up when
you actually run the app (`npm run dev`, or a real deployment).

## Stack

- React 19 + TypeScript, Vite build
- Tailwind CSS v4 (dark theme via `@theme` tokens in `src/index.css`)
- `react-router-dom` for routing
- Hand-rolled SVG chart with pointer-based scrubbing (no charting library)
- `lucide-react` icons

## Pages

- **Home** (`/`) — portfolio value, interactive value chart with range
  tabs (1D/1W/1M/3M/YTD/1Y/5Y/ALL), buying power, holdings list, watchlist
  preview.
- **Stock detail** (`/stock/:symbol`) — price chart, your position, key
  stats, about section, and a Buy/Sell order sheet with a keypad, review
  step, and confirmation.
- **Search** (`/search`) — live filter across mock stocks/ETFs/crypto.
- **Lists** (`/lists`) — watchlist.
- **Account** (`/account`) — profile summary, settings rows, order history.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint      # oxlint
```
