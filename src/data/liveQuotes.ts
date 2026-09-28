import { useSyncExternalStore } from "react";
import type { Stock } from "../types";
import { STOCKS, getStock } from "./stocks";

// Every stock in the data file gets a real, polled quote — stocks and funds
// go through Finnhub (needs a free API key you get yourself — see README);
// crypto goes through CoinGecko, which needs no key and allows direct
// browser calls. Derived from STOCKS itself so a symbol added there is
// automatically wired up for live quotes too, no separate list to update.
export const LIVE_SYMBOLS = STOCKS.map((s) => s.symbol);
export type LiveSymbol = string;

export function isLiveSymbol(symbol: string): symbol is LiveSymbol {
  return LIVE_SYMBOLS.includes(symbol);
}

// CoinGecko identifies coins by slug, not ticker — map the crypto symbols
// this app knows about to their CoinGecko id here as more are added.
const COINGECKO_IDS: Partial<Record<string, string>> = {
  BTC: "bitcoin",
};

export interface LiveQuote {
  price: number;
  prevClose: number;
  updatedAt: number;
}

export type QuoteStatus = "idle" | "loading" | "live" | "error";

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;
// Finnhub's free tier caps out at 60 calls/minute. With one call per stock
// per poll, this interval needs to scale with how many symbols are live —
// a fixed 20s was fine for 5 tickers but would blow past the cap once every
// stock in STOCKS is included. 45s keeps even a worst-case overlap between
// two poll cycles comfortably under the limit.
const POLL_MS = 45_000;

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

async function fetchCoinGeckoQuote(coinId: string): Promise<LiveQuote> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
  );
  if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.[coinId]?.usd;
  const changePct = data?.[coinId]?.usd_24h_change;
  if (typeof price !== "number") throw new Error("CoinGecko returned no data");
  const prevClose = typeof changePct === "number" ? price / (1 + changePct / 100) : price;
  return { price, prevClose, updatedAt: Date.now() };
}

async function fetchQuoteFor(symbol: LiveSymbol): Promise<LiveQuote> {
  const isCrypto = getStock(symbol)?.category === "crypto";
  if (isCrypto) {
    const coinId = COINGECKO_IDS[symbol];
    if (!coinId) throw new Error(`No CoinGecko id mapped for ${symbol}`);
    return fetchCoinGeckoQuote(coinId);
  }
  return fetchFinnhubQuote(symbol);
}

async function refreshSymbol(symbol: LiveSymbol) {
  statuses[symbol] = "loading";
  emit();
  try {
    quotes[symbol] = await fetchQuoteFor(symbol);
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
