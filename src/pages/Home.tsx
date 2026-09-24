import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine, Bell, Globe, TrendingUp } from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { useNotifications } from "../context/NotificationsContext";
import { getStock } from "../data/stocks";
import { getPortfolioHistory } from "../data/portfolioHistory";
import { useLiveQuotes } from "../data/liveQuotes";
import { InteractiveChart } from "../components/InteractiveChart";
import { RangeTabs } from "../components/RangeTabs";
import { StockRow } from "../components/StockRow";
import { PriceChange } from "../components/PriceChange";
import { Logo } from "../components/Logo";
import { CashSheet } from "../components/CashSheet";
import { LocaleCurrencySheet } from "../components/LocaleCurrencySheet";
import { NextStepCard } from "../components/NextStepCard";
import { RecentActivityCard } from "../components/RecentActivityCard";
import type { PricePoint, Range } from "../types";

interface ActionButtonProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  to?: string;
}

function ActionButton({ icon: Icon, label, onClick, to }: ActionButtonProps) {
  const content = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
        <Icon size={20} className="text-brand-light" />
      </div>
      <span className="mt-1.5 text-[12px] font-medium text-ink-dim">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="flex flex-1 flex-col items-center">
        {content}
      </Link>
    );
  }
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.12 }}
      className="flex flex-1 flex-col items-center cursor-pointer"
    >
      {content}
    </motion.button>
  );
}

export function Home() {
  const { holdings, cash, equityValue, totalValue, watchlist, orders, transfers } = usePortfolio();
  const { user } = useAuth();
  const { t } = useLocale();
  const { displayCurrency, formatDisplay } = useCurrency();
  const { unreadCount } = useNotifications();
  const [range, setRange] = useState<Range>("1D");
  const [scrub, setScrub] = useState<PricePoint | null>(null);
  const [cashMode, setCashMode] = useState<"deposit" | "withdraw" | null>(null);
  const [showLocaleSheet, setShowLocaleSheet] = useState(false);
  const liveQuotes = useLiveQuotes();

  const history = useMemo(
    () => getPortfolioHistory(holdings, cash, range),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveQuotes triggers recompute on each poll
    [holdings, cash, range, liveQuotes],
  );

  const startValue = history[0]?.price ?? totalValue;
  const displayValue = scrub ? scrub.price : totalValue;
  const diff = displayValue - startValue;
  const diffPercent = startValue !== 0 ? (diff / startValue) * 100 : 0;
  const positive = diff >= 0;

  const costBasis = useMemo(
    () => holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0),
    [holdings],
  );
  const investmentGain = equityValue - costBasis;
  const investmentGainPercent = costBasis > 0 ? (investmentGain / costBasis) * 100 : 0;

  const latestActivity = useMemo(() => {
    const items = [
      ...orders.map((o) => ({ kind: "order" as const, timestamp: o.timestamp, data: o })),
      ...transfers.map((t2) => ({ kind: "transfer" as const, timestamp: t2.timestamp, data: t2 })),
    ];
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items[0] ?? null;
  }, [orders, transfers]);

  const isNewWithNoActivity = latestActivity === null;

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between gap-2 px-4 pt-5 lg:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <Logo size={20} />
          <span className="text-base font-semibold text-ink">Arvo</span>
        </div>
        <button
          onClick={() => setShowLocaleSheet(true)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-ink-dim hover:bg-surface-3 cursor-pointer lg:hidden"
        >
          <Globe size={13} />
          {displayCurrency === "USD" ? "$" : "₺"}
        </button>
        <Link
          to="/notifications"
          aria-label={t("notifications.title")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-dim hover:bg-surface-3 lg:hidden"
        >
          <Bell size={16} />
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" />}
        </Link>
        <Link
          to="/account"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full brand-gradient text-sm font-semibold text-white lg:hidden"
        >
          {(() => {
            const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
            const avatarUrl = meta.avatar_url ?? meta.picture;
            if (avatarUrl) {
              return <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />;
            }
            const name = meta.full_name ?? meta.name ?? user?.email;
            return name ? name[0]!.toUpperCase() : "G";
          })()}
        </Link>
      </div>

      {/* Q1: How much do I have? */}
      <div className="relative px-4 pt-6 lg:px-6">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--color-brand)", opacity: 0.08 }}
        />
        <span className="text-sm text-ink-faint">{t("home.totalBalance")}</span>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-ink lg:text-5xl">
          {formatDisplay(displayValue)}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <PriceChange amount={diff} percent={diffPercent} size="md" formatAmount={formatDisplay} />
          <span className="text-sm text-ink-faint">{scrub ? "" : t("home.todayLabel")}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="text-[12px] text-ink-faint">{t("home.invested")}</div>
            <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
              {formatDisplay(equityValue)}
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="text-[12px] text-ink-faint">{t("home.cashAvailable")}</div>
            <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
              {formatDisplay(cash)}
            </div>
          </div>
        </div>

        {/* Q2: How am I doing? — investment gain/loss, kept separate from cash added */}
        <Link to="/performance" className="mt-2 block rounded-xl bg-surface-2 px-3.5 py-3 hover:bg-surface-3">
          <div className="text-[12px] text-ink-faint">{t("home.gainLoss")}</div>
          <div className="mt-0.5">
            <PriceChange
              amount={investmentGain}
              percent={investmentGainPercent}
              size="sm"
              formatAmount={formatDisplay}
            />
          </div>
          <div className="mt-1 text-[11px] text-ink-faint">{t("home.gainLossHint")}</div>
        </Link>

        {/* Q3: What can I do next? */}
        <div className="mt-4 flex gap-1">
          <ActionButton icon={ArrowDownToLine} label={t("home.addMoney")} onClick={() => setCashMode("deposit")} />
          <ActionButton icon={TrendingUp} label={t("home.invest")} to="/search" />
          <ActionButton icon={ArrowUpFromLine} label={t("home.withdraw")} onClick={() => setCashMode("withdraw")} />
        </div>
      </div>

      <div className="mt-4">
        <InteractiveChart
          data={history}
          positive={positive}
          height={200}
          onScrub={(p) => setScrub(p)}
        />
      </div>

      <div className="mt-4 px-4 lg:px-6">
        <RangeTabs value={range} onChange={setRange} positive={positive} />
      </div>

      <AnimatePresence>
        {cashMode && <CashSheet mode={cashMode} onClose={() => setCashMode(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showLocaleSheet && <LocaleCurrencySheet onClose={() => setShowLocaleSheet(false)} />}
      </AnimatePresence>

      {/* One contextual card — never both, to keep Home focused. */}
      <AnimatePresence>
        {isNewWithNoActivity ? (
          <NextStepCard key="next-step" hasCash={cash > 0} onAddMoney={() => setCashMode("deposit")} />
        ) : (
          <RecentActivityCard key="recent-activity" item={latestActivity} />
        )}
      </AnimatePresence>

      <section className="mt-8">
        <h2 className="px-4 pb-1 text-lg font-semibold text-ink lg:px-6">
          {t("home.investingHeading")}
        </h2>
        <div className="px-2 lg:px-4">
          {holdings.length === 0 && (
            <p className="px-2 py-6 text-sm text-ink-faint">{t("home.emptyHoldings")}</p>
          )}
          {holdings.map((h) => {
            const stock = getStock(h.symbol);
            if (!stock) return null;
            return <StockRow key={h.symbol} stock={stock} />;
          })}
        </div>
      </section>

      {watchlist.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-4 pb-1 lg:px-6">
            <h2 className="text-lg font-semibold text-ink">{t("home.watchlistHeading")}</h2>
            <Link to="/lists" className="text-sm font-medium text-brand-light hover:brightness-125">
              {t("home.seeAll")}
            </Link>
          </div>
          <div className="px-2 lg:px-4">
            {watchlist.slice(0, 4).map((symbol) => {
              const stock = getStock(symbol);
              if (!stock) return null;
              return <StockRow key={symbol} stock={stock} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
