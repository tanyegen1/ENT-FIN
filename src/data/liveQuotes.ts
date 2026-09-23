import { useSyncExternalStore } from "react";
import type { Stock } from "../types";
import { getStock } from "./stocks";

// Real quotes are wired up for only these five tickers. Stocks go through
// Finnhub (needs a free API key you get yourself — see README); Bitcoin
// goes through CoinGecko, which needs no key and allows direct browser
// calls. Everything else in the app stays on static mock data.
export const LIVE_SYMBOLS = ["AAPL", "TSLA", "NVDA", "COIN", "BTC"] as const;
export type LiveSymbol = (typeof LIVE_SYMBOLS)[number];

export function isLiveSymbol(symbol: string): symbol is LiveSymbol {
  return (LIVE_SYMBOLS as readonly string[]).includes(symbol);
}

export interface LiveQuote {
  price: number;
  prevClose: number;
  updatedAt: number;
}

export type QuoteStatus = "idle" | "loading" | "live" | "error";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;
const POLL_MS = 20_000;

const quotes: Partial<Record<LiveSymbol, LiveQuote>> = {};
const statuses: Partial<Record<LiveSymbol, QuoteStatus>> = {};
const errors: Partial<Record<LiveSymbol, string>> = {};

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot = { quotes, statuses, errors };

function emit() {
  // New object identity so useSyncExternalStore sees a change.
  snapshot = { quotes: { ...quotes }, statuses: { ...statuses }, errors: { ...errors } };
  for (const l of listeners) l();
}

export function subscribeLiveQuotes(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLiveSnapshot() {
  return snapshot;
}

async function fetchFinnhubQuote(symbol: LiveSymbol): Promise<LiveQuote> {
  if (!FINNHUB_KEY) {
    throw new Error("No Finnhub API key configured (VITE_FINNHUB_API_KEY)");
  }
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
  );
  if (!res.ok) throw new Error(`Finnhub returned HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.c !== "number" || data.c === 0) {
    throw new Error("Finnhub returned no data (bad symbol, key, or rate limit)");
  }
  return { price: data.c, prevClose: data.pc, updatedAt: Date.now() };
}

async function fetchBitcoinQuote(): Promise<LiveQuote> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
  );
  if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.bitcoin?.usd;
  const changePct = data?.bitcoin?.usd_24h_change;
  if (typeof price !== "number") throw new Error("CoinGecko returned no data");
  const prevClose = typeof changePct === "number" ? price / (1 + changePct / 100) : price;
  return { price, prevClose, updatedAt: Date.now() };
}

async function refreshSymbol(symbol: LiveSymbol) {
  statuses[symbol] = "loading";
  emit();
  try {
    quotes[symbol] = symbol === "BTC" ? await fetchBitcoinQuote() : await fetchFinnhubQuote(symbol);
    statuses[symbol] = "live";
    delete errors[symbol];
  } catch (err) {
    statuses[symbol] = "error";
    errors[symbol] = err instanceof Error ? err.message : String(err);
  }
  emit();
}

async function refreshAll() {
  await Promise.all(LIVE_SYMBOLS.map(refreshSymbol));
}

let started = false;

export function startLiveQuotes() {
  if (started) return;
  started = true;
  refreshAll();
  setInterval(refreshAll, POLL_MS);
}

export function getLiveQuote(symbol: string): LiveQuote | undefined {
  return isLiveSymbol(symbol) ? quotes[symbol] : undefined;
}

export function getLiveStock(symbol: string): Stock | undefined {
  const base = getStock(symbol);
  if (!base) return undefined;
  const live = getLiveQuote(symbol);
  if (!live) return base;
  return { ...base, price: live.price, prevClose: live.prevClose };
}

/** Subscribes to live-quote updates so the caller re-renders as data arrives. */
export function useLiveQuotes() {
  return useSyncExternalStore(subscribeLiveQuotes, getLiveSnapshot, getLiveSnapshot);
}

/** A single ticker's live-merged Stock, reactive to updates. */
export function useStock(symbol: string): Stock | undefined {
  useLiveQuotes();
  return getLiveStock(symbol);
}

export function useQuoteStatus(symbol: string): QuoteStatus | undefined {
  const { statuses } = useLiveQuotes();
  return isLiveSymbol(symbol) ? statuses[symbol] ?? "idle" : undefined;
}

export function useQuoteError(symbol: string): string | undefined {
  const { errors } = useLiveQuotes();
  return isLiveSymbol(symbol) ? errors[symbol] : undefined;
}
