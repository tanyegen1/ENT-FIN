import type { AssetCategory, Holding, Stock, TransferRecord } from "../types";
import { STOCKS, getStock, stocksByCategory } from "../data/stocks";
import { buildInsights } from "./insights";
import { formatShares } from "./format";

type T = (path: string, vars?: Record<string, string | number>) => string;
type FormatAmount = (usd: number, opts?: { compact?: boolean; precise?: boolean }) => string;

export interface ChatPortfolioSnapshot {
  cash: number;
  equityValue: number;
  totalValue: number;
  spendableCash: number;
  holdings: Holding[];
  watchlist: string[];
  transfers: TransferRecord[];
}

export interface ChatReply {
  text: string;
  linkTo?: string;
  linkLabel?: string;
}

interface Ctx {
  t: T;
  formatDisplay: FormatAmount;
  portfolio: ChatPortfolioSnapshot;
}

// JS's \b word-boundary only recognizes ASCII [A-Za-z0-9_] as "word" characters,
// so it silently fails to match at the edge of Turkish letters like ı/ğ/ş/ç/ö/ü
// (e.g. \bmant[iı]kl[iı]\b never matches "mantıklı" — the boundary check right
// after "ı" fails since neither "ı" nor the following space/punctuation counts
// as a word character under plain ASCII \b). Unicode property escapes fix this.
function wordRegex(alternatives: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

const KEYWORDS = {
  greeting: wordRegex(["hi", "hello", "hey", "merhaba", "selam"]),
  help: wordRegex(["help", "what can you do", "nas[iı]l yard[iı]m", "ne yapabilirsin"]),
  compareVerb: wordRegex([
    "buy",
    "buying",
    "invest",
    "worth it",
    "worth buying",
    "should i",
    "makes sense",
    "compare",
    "al[iı]r m[iı]y[iı]m",
    "almal[iı] m[iı]y[iı]m",
    "mant[iı]kl[iı]",
    "yat[iı]r[iı]m yapmal[iı]",
  ]),
  whatToBuy: wordRegex([
    "what should i buy",
    "what to buy",
    "recommend",
    "suggest",
    "ne almal[iı]y[iı]m",
    "ne önerirsin",
    "öneri",
  ]),
  portfolioValue: wordRegex([
    "portfolio",
    "net worth",
    "total value",
    "how much (do i have|am i worth)",
    "portf[oö]y",
    "toplam de[gğ]er",
    "ne kadar param",
    "servet",
  ]),
  gainLoss: wordRegex(["gain", "loss", "performance", "how am i doing", "up or down", "kazan[cç]", "kay[iı]p", "performans"]),
  cash: wordRegex(["cash", "buying power", "deposit", "withdraw", "nakit", "bakiye", "kullan[iı]labilir"]),
  holdings: wordRegex(["own", "holding", "position", "what do i have", "elimde", "sahip oldu[gğ]um", "pozisyon"]),
  watchlist: wordRegex(["watchlist", "saved", "izleme listesi", "kaydetti[gğ]im"]),
};

function tokenize(text: string): string[] {
  // Unicode-aware so Turkish letters (ı, ğ, ş, ç, ö, ü) stay part of the word
  // they belong to instead of being treated as separators like whitespace.
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function findMentionedStock(message: string): Stock | null {
  const words = tokenize(message).filter((w) => w.length >= 2);
  if (words.length === 0) return null;

  let best: { stock: Stock; score: number } | null = null;
  for (const s of STOCKS) {
    // Whole-word matching against a tokenized haystack, not raw substring
    // containment — otherwise a word like "what" false-matches an alias like
    // "whatsapp" just because it happens to appear inside it.
    const haystackWords = new Set(tokenize([s.symbol, s.name, ...s.aliases].join(" ")));
    let score = 0;
    if (words.includes(s.symbol.toLowerCase())) score += 5;
    for (const w of words) {
      if (w.length >= 4 && haystackWords.has(w)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { stock: s, score };
  }
  return best?.stock ?? null;
}

function categoryLabelKey(category: AssetCategory): string {
  if (category === "fund") return "search.categoryFund";
  if (category === "crypto") return "search.categoryCrypto";
  return "search.categoryStock";
}

function holdingsList(portfolio: ChatPortfolioSnapshot, t: T, formatDisplay: FormatAmount): string {
  return portfolio.holdings
    .map((h) => {
      const stock = getStock(h.symbol);
      const price = stock?.price ?? h.avgCost;
      return `• ${h.symbol} — ${formatShares(h.shares)} ${t("common.shares")} (${formatDisplay(h.shares * price)})`;
    })
    .join("\n");
}

function watchlistList(portfolio: ChatPortfolioSnapshot, formatDisplay: FormatAmount): string {
  return portfolio.watchlist
    .map((symbol) => {
      const stock = getStock(symbol);
      if (!stock) return null;
      return `• ${stock.symbol} — ${stock.name} (${formatDisplay(stock.price, { precise: true })})`;
    })
    .filter((line): line is string => !!line)
    .join("\n");
}

function suggestionCandidates(portfolio: ChatPortfolioSnapshot): { stock: Stock; reasonKey: string; reasonVars?: Record<string, string> }[] {
  const ownedSymbols = new Set(portfolio.holdings.map((h) => h.symbol));
  const watchlistCandidates = portfolio.watchlist
    .filter((s) => !ownedSymbols.has(s))
    .map((s) => getStock(s))
    .filter((s): s is Stock => !!s)
    .slice(0, 3)
    .map((stock) => ({ stock, reasonKey: "chat.suggestReasonWatchlist" }));
  if (watchlistCandidates.length > 0) return watchlistCandidates;

  const ownedCategories = new Set(
    portfolio.holdings.map((h) => getStock(h.symbol)?.category).filter((c): c is AssetCategory => !!c),
  );
  const categories: AssetCategory[] = ["fund", "crypto", "stock"];
  const picks: { stock: Stock; reasonKey: string; reasonVars?: Record<string, string> }[] = [];
  for (const cat of categories) {
    if (ownedCategories.has(cat)) continue;
    const candidate = stocksByCategory(cat).find((s) => !ownedSymbols.has(s.symbol));
    if (candidate) {
      picks.push({ stock: candidate, reasonKey: "chat.suggestReasonCategory", reasonVars: { category: cat } });
    }
    if (picks.length >= 2) break;
  }
  if (picks.length > 0) return picks;

  return STOCKS.filter((s) => !ownedSymbols.has(s.symbol))
    .slice(0, 2)
    .map((stock) => ({ stock, reasonKey: "chat.suggestReasonExplore" }));
}

function buildComparisonReply(stock: Stock, ctx: Ctx): ChatReply {
  const { t, formatDisplay, portfolio } = ctx;
  const holding = portfolio.holdings.find((h) => h.symbol === stock.symbol);
  const insights = buildInsights(stock, t, formatDisplay);

  const lines: string[] = [t("chat.compareIntro", { symbol: stock.symbol })];
  for (const item of insights) {
    lines.push(`• ${item.text}`);
  }

  lines.push("");
  if (holding) {
    lines.push(
      t("chat.compareOwned", {
        shares: formatShares(holding.shares),
        symbol: stock.symbol,
        value: formatDisplay(holding.shares * stock.price),
      }),
    );
  } else {
    lines.push(t("chat.compareNotOwned", { symbol: stock.symbol }));
  }

  const affordableShares = stock.price > 0 ? Math.floor((portfolio.spendableCash / stock.price) * 1000) / 1000 : 0;
  if (affordableShares >= 1) {
    lines.push(
      t("chat.compareBuyingPower", {
        price: formatDisplay(stock.price, { precise: true }),
        cash: formatDisplay(portfolio.spendableCash),
        shares: formatShares(Math.floor(affordableShares)),
      }),
    );
  } else {
    lines.push(
      t("chat.compareBuyingPowerShort", {
        price: formatDisplay(stock.price, { precise: true }),
        cash: formatDisplay(portfolio.spendableCash),
      }),
    );
  }

  lines.push("");
  lines.push(t("chat.compareDisclaimer", { symbol: stock.symbol }));

  return { text: lines.join("\n"), linkTo: `/stock/${stock.symbol}`, linkLabel: t("chat.viewStock", { symbol: stock.symbol }) };
}

export function answerMessage(rawMessage: string, ctx: Ctx): ChatReply {
  const { t, formatDisplay, portfolio } = ctx;
  const message = rawMessage.trim();

  if (KEYWORDS.greeting.test(message)) {
    return { text: t("chat.greeting") };
  }
  if (KEYWORDS.help.test(message)) {
    return { text: t("chat.help") };
  }

  // A specific-stock question ("does buying AAPL make sense?") is checked before
  // the generic "what should I buy" intent, since it's the more specific match —
  // but only when a real stock was actually recognized in the message. A phrase
  // like "buying power" also contains a compareVerb word ("buying") without
  // naming any stock, so it falls through to the other intents below (cash,
  // in this case) rather than being force-matched here.
  const wantsCompare = KEYWORDS.compareVerb.test(message);
  if (wantsCompare) {
    const mentioned = findMentionedStock(message);
    if (mentioned) return buildComparisonReply(mentioned, ctx);
  }

  if (KEYWORDS.whatToBuy.test(message)) {
    const candidates = suggestionCandidates(portfolio);
    if (candidates.length === 0) {
      return { text: t("chat.suggestNone") };
    }
    const lines = [t("chat.suggestIntro")];
    for (const { stock, reasonKey, reasonVars } of candidates) {
      const reason = t(reasonKey, { ...reasonVars, category: reasonVars?.category ? t(categoryLabelKey(reasonVars.category as AssetCategory)) : "" });
      lines.push(t("chat.suggestItem", { symbol: stock.symbol, name: stock.name, reason }));
    }
    return { text: lines.join("\n") };
  }

  if (KEYWORDS.cash.test(message)) {
    return { text: t("chat.cash", { amount: formatDisplay(portfolio.spendableCash) }) };
  }

  if (KEYWORDS.gainLoss.test(message)) {
    const costBasis = portfolio.holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0);
    const gain = portfolio.equityValue - costBasis;
    const percent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    const sign = gain >= 0 ? "+" : "";
    return {
      text: t("chat.gainLoss", {
        sign,
        amount: formatDisplay(Math.abs(gain)),
        percent: `${sign}${percent.toFixed(2)}%`,
      }),
      linkTo: "/performance",
      linkLabel: t("chat.viewPerformance"),
    };
  }

  if (KEYWORDS.holdings.test(message)) {
    if (portfolio.holdings.length === 0) return { text: t("chat.holdingsEmpty") };
    return { text: t("chat.holdingsList", { list: holdingsList(portfolio, t, formatDisplay) }) };
  }

  if (KEYWORDS.watchlist.test(message)) {
    if (portfolio.watchlist.length === 0) return { text: t("chat.watchlistEmpty") };
    return { text: t("chat.watchlistList", { list: watchlistList(portfolio, formatDisplay) }) };
  }

  if (KEYWORDS.portfolioValue.test(message)) {
    return {
      text: t("chat.portfolioValue", {
        total: formatDisplay(portfolio.totalValue),
        equity: formatDisplay(portfolio.equityValue),
        cash: formatDisplay(portfolio.spendableCash),
      }),
      linkTo: "/account",
      linkLabel: t("chat.viewAccount"),
    };
  }

  if (wantsCompare) {
    return { text: t("chat.compareNotFound") };
  }

  return { text: t("chat.fallback") };
}
