import { Link } from "react-router-dom";
import { AlertTriangle, Clock3 } from "lucide-react";
import clsx from "clsx";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { useLiveQuotes } from "../data/liveQuotes";
import { getStock } from "../data/stocks";
import { StockLogo } from "./StockLogo";
import { describeFillProgress, describeRuleSummary } from "../lib/priceRuleDescriptions";
import type { PriceRuleOrder, PriceRuleStatus } from "../types";

const PENDING_STATUSES = new Set<PriceRuleStatus>(["waiting", "triggered", "partial"]);

const STATUS_LABEL_KEY: Record<"waiting" | "triggered" | "partial", string> = {
  waiting: "priceRules.statusWaiting",
  triggered: "priceRules.statusTriggered",
  partial: "priceRules.statusPartial",
};

interface PendingOrdersSectionProps {
  /** Only this instrument's pending orders — used on the stock page. Omit for every pending order — used on the dashboard. */
  symbol?: string;
  className?: string;
  /** Skips this component's own horizontal padding — for embedding inside a parent section that already has its own (e.g. the stock page). */
  noPadding?: boolean;
}

/**
 * The one place a beginner should always be able to see "what's still
 * queued" — never mixed in with completed trades, never counted toward
 * holdings (see PortfolioContext: only filledQuantity ever touches
 * holdings/cash). Shown on the dashboard (every symbol) and the stock page
 * (just that symbol); both read the same live priceRules state, so a
 * queued order appears here the instant it's created.
 */
export function PendingOrdersSection({ symbol, className, noPadding }: PendingOrdersSectionProps) {
  const { priceRules } = usePortfolio();
  const { t } = useLocale();
  const { formatDisplay } = useCurrency();
  useLiveQuotes();

  const pending = priceRules
    .filter((r) => PENDING_STATUSES.has(r.status) && (!symbol || r.symbol === symbol))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (pending.length === 0) return null;

  const padding = noPadding ? "" : "px-4 lg:px-6";

  return (
    <section className={className}>
      <div className={clsx("flex items-center justify-between pb-1", padding)}>
        <h2 className="text-lg font-semibold text-ink">{t("pendingOrders.heading")}</h2>
        <Link to="/price-rules" className="text-sm font-medium text-brand-light hover:brightness-125">
          {t("home.seeAll")}
        </Link>
      </div>
      <div className={clsx("flex flex-col gap-2", padding)}>
        {pending.slice(0, 4).map((order) => (
          <PendingOrderRow key={order.id} order={order} showSymbol={!symbol} t={t} formatDisplay={formatDisplay} />
        ))}
      </div>
    </section>
  );
}

interface PendingOrderRowProps {
  order: PriceRuleOrder;
  showSymbol: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDisplay: (value: number, opts?: { precise?: boolean }) => string;
}

function PendingOrderRow({ order, showSymbol, t, formatDisplay }: PendingOrderRowProps) {
  const stock = getStock(order.symbol);
  const statusKey = order.status as "waiting" | "triggered" | "partial";
  const isMarketWaiting = order.orderType === "market" && order.status === "waiting";

  return (
    <Link
      to="/price-rules"
      className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 px-4 py-3 hover:bg-surface-3"
    >
      {showSymbol && stock ? (
        <StockLogo symbol={stock.symbol} name={stock.name} fallbackColor={stock.color} size={32} />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-dim">
          {order.status === "triggered" ? <AlertTriangle size={14} /> : <Clock3 size={14} />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{describeRuleSummary(order, t, formatDisplay)}</div>
        {order.status === "partial" && (
          <div className="truncate text-[12px] text-ink-faint">{describeFillProgress(order, t)}</div>
        )}
      </div>
      <span
        className={clsx(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          order.status === "partial" || order.status === "triggered" ? "bg-brand-soft text-brand-light" : "bg-surface-3 text-ink-dim",
        )}
      >
        {t(isMarketWaiting ? "priceRules.statusWaitingMarket" : STATUS_LABEL_KEY[statusKey])}
      </span>
    </Link>
  );
}
