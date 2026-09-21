# Pulse — Investing UI

A trading app front end built as a React + TypeScript + Vite SPA, following
the same interaction patterns and visual language as popular commission-free
brokerage apps: a dark theme, green/red price deltas, a scrubbable price
chart, and a market-order flow driven by a numeric keypad.

All data is mocked client-side — there is no backend, brokerage, or real
market data. Portfolio state (cash, holdings, watchlist, order history)
lives in React context and persists to `localStorage`.

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
