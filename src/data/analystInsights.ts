import type { AnalystInsight } from "../types";

/**
 * Mock "analyst consensus" for a handful of widely-watched names — simulated
 * for this practice app, not real research. Ratings, price targets, and the
 * catalyst bullets below are hand-authored (like Stock.about) rather than
 * derived from any live source; the 12-month horizon matches the convention
 * real sell-side price targets use. Covers 5 symbols today; more can be
 * added to this map the same way as the app grows.
 */
export const ANALYST_INSIGHTS: Record<string, AnalystInsight> = {
  NVDA: {
    symbol: "NVDA",
    rating: "strong-buy",
    score: 90,
    targetLow: 155,
    targetAverage: 185,
    targetHigh: 220,
    horizonMonths: 12,
    summary:
      "NVIDIA remains the most broadly recommended name in this group — analysts see AI infrastructure spending from hyperscalers continuing well into next year, even as some flag the stock's now-massive size as a risk to further re-rating.",
    catalysts: [
      {
        direction: "positive",
        detail:
          "Hyperscalers (Microsoft, Google, Amazon, Meta) keep guiding to higher AI data-center capital spending, NVIDIA's core customer base.",
      },
      {
        direction: "positive",
        detail:
          "New chip generations keep extending NVIDIA's performance lead over AMD and in-house cloud-provider chips.",
      },
      {
        direction: "negative",
        detail:
          "US export restrictions on advanced AI chips to China remain a policy risk to a meaningful slice of addressable demand.",
      },
      {
        direction: "neutral",
        detail:
          "At over $3 trillion in market value, NVIDIA needs sustained, large-scale demand growth just to keep pace with expectations already priced in.",
      },
    ],
  },
  AAPL: {
    symbol: "AAPL",
    rating: "buy",
    score: 68,
    targetLow: 235,
    targetAverage: 255,
    targetHigh: 280,
    horizonMonths: 12,
    summary:
      "Apple's services momentum and an expected AI-driven upgrade cycle keep the stock in buy territory for most desks, though several flag the premium multiple against slowing hardware growth.",
    catalysts: [
      {
        direction: "positive",
        detail:
          "Services revenue (App Store, iCloud, subscriptions) keeps growing faster than hardware and carries much higher margins.",
      },
      {
        direction: "positive",
        detail:
          "An AI-refreshed iPhone lineup is expected to drive a stronger-than-usual upgrade cycle over the next year.",
      },
      {
        direction: "negative",
        detail:
          "Regulatory pressure in the EU and US over App Store fees and antitrust remains an overhang on services margins.",
      },
      {
        direction: "neutral",
        detail:
          "China is both Apple's largest growth market and its biggest geopolitical risk, given trade tensions and local competition.",
      },
    ],
  },
  META: {
    symbol: "META",
    rating: "buy",
    score: 74,
    targetLow: 610,
    targetAverage: 700,
    targetHigh: 780,
    horizonMonths: 12,
    summary:
      "Meta's advertising business keeps outgrowing peers on the back of AI-driven ad targeting, and its lower valuation relative to other AI-exposed megacaps keeps most desks constructive despite heavy AI infrastructure spending.",
    catalysts: [
      {
        direction: "positive",
        detail:
          "AI-driven ad-targeting improvements keep lifting ad prices and conversion, even as user growth matures.",
      },
      {
        direction: "positive",
        detail:
          "Meta trades at a discount to other large AI-exposed tech names despite posting similar growth.",
      },
      {
        direction: "negative",
        detail: "Reality Labs (AR/VR) continues to lose billions per year with no clear near-term profitability path.",
      },
      {
        direction: "neutral",
        detail:
          "Heavy AI infrastructure capital spending is pressuring free cash flow, a trend analysts are watching closely through next year.",
      },
    ],
  },
  TSLA: {
    symbol: "TSLA",
    rating: "hold",
    score: 50,
    targetLow: 210,
    targetAverage: 262,
    targetHigh: 320,
    horizonMonths: 12,
    summary:
      "Analysts are split on Tesla: bulls point to robotaxi and energy-storage optionality, while bears flag slowing core EV deliveries and a valuation that already prices in a lot of future growth.",
    catalysts: [
      {
        direction: "positive",
        detail:
          "Energy storage (Megapack) revenue is growing faster than the core vehicle business and carries stronger margins.",
      },
      {
        direction: "negative",
        detail:
          "EV price competition from Chinese and legacy automakers is compressing delivery growth and margins.",
      },
      {
        direction: "negative",
        detail:
          "Regulatory approval for full self-driving/robotaxi service remains uncertain and varies by country.",
      },
      {
        direction: "neutral",
        detail:
          "Tesla's valuation already assumes significant success in autonomy and robotics, raising the bar for upside surprises.",
      },
    ],
  },
  BTC: {
    symbol: "BTC",
    rating: "buy",
    score: 70,
    targetLow: 85_000,
    targetAverage: 122_000,
    targetHigh: 150_000,
    horizonMonths: 12,
    summary:
      "Bitcoin's outlook has turned more constructive as spot ETF inflows and growing institutional allocation offset its historically high volatility — though forecasts here vary more than for any other name in this list.",
    catalysts: [
      {
        direction: "positive",
        detail:
          "Spot Bitcoin ETFs have opened the asset to a much broader base of institutional and retirement-account capital.",
      },
      {
        direction: "positive",
        detail:
          "A growing number of public companies and sovereign entities are adding Bitcoin to their balance sheets as a reserve asset.",
      },
      {
        direction: "negative",
        detail: "Regulatory treatment still varies widely by country, and a major policy reversal anywhere remains a real risk.",
      },
      {
        direction: "neutral",
        detail:
          "Bitcoin's price swings are still far larger than any stock in this list — treat any single price target with extra caution.",
      },
    ],
  },
};

export const ANALYST_COVERED_SYMBOLS: string[] = Object.keys(ANALYST_INSIGHTS);

export function getAnalystInsight(symbol: string): AnalystInsight | undefined {
  return ANALYST_INSIGHTS[symbol];
}

export function hasAnalystInsight(symbol: string): boolean {
  return symbol in ANALYST_INSIGHTS;
}
