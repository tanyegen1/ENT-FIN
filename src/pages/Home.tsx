import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine, FlaskConical } from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { useAuth } from "../context/AuthContext";
import { useOnboarding } from "../context/OnboardingContext";
import { getStock } from "../data/stocks";
import { getPortfolioHistory } from "../data/portfolioHistory";
import { useLiveQuotes } from "../data/liveQuotes";
import { InteractiveChart } from "../components/InteractiveChart";
import { RangeTabs } from "../components/RangeTabs";
import { StockRow } from "../components/StockRow";
import { PriceChange } from "../components/PriceChange";
import { Logo } from "../components/Logo";
import { CashSheet } from "../components/CashSheet";
import { GettingStartedCard } from "../components/GettingStartedCard";
import { formatCurrency } from "../lib/format";
import type { PricePoint, Range } from "../types";

export function Home() {
  const { holdings, cash, totalValue, watchlist } = usePortfolio();
  const { user } = useAuth();
  const { profile, dismissTips } = useOnboarding();
  const [range, setRange] = useState<Range>("1D");
  const [scrub, setScrub] = useState<PricePoint | null>(null);
  const [cashMode, setCashMode] = useState<"deposit" | "withdraw" | null>(null);
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

  const rangeLabel: Record<Range, string> = {
    "1D": "Today",
    "1W": "Past week",
    "1M": "Past month",
    "3M": "Past 3 months",
    YTD: "Year to date",
    "1Y": "Past year",
    "5Y": "Past 5 years",
    ALL: "All time",
  };

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 pt-5 lg:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <Logo size={20} />
          <span className="text-base font-semibold text-ink">Arvo</span>
        </div>
        <Link
          to="/account"
          className="ml-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full brand-gradient text-sm font-semibold text-white lg:hidden"
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

      <div className="relative px-4 pt-6 lg:px-6">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--color-brand)", opacity: 0.08 }}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-faint">Portfolio value</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            <FlaskConical size={11} />
            Paper trading
          </span>
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-ink lg:text-5xl">
          {formatCurrency(displayValue)}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <PriceChange amount={diff} percent={diffPercent} size="md" />
          <span className="text-sm text-ink-faint">
            {scrub ? "" : rangeLabel[range]}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <InteractiveChart
          data={history}
          positive={positive}
          height={240}
          onScrub={(p) => setScrub(p)}
        />
      </div>

      <div className="mt-4 px-4 lg:px-6">
        <RangeTabs value={range} onChange={setRange} positive={positive} />
      </div>

      <div className="mx-4 mt-6 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5 lg:mx-6">
        <div>
          <div className="text-[13px] text-ink-faint">Buying power</div>
          <div className="text-[17px] font-semibold tabular-nums text-ink">
            {formatCurrency(cash)}
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            onClick={() => setCashMode("deposit")}
            aria-label="Add practice cash"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-brand-light hover:brightness-125 cursor-pointer"
            whileTap={{ scale: 0.88 }}
            transition={{ duration: 0.12 }}
          >
            <ArrowDownToLine size={17} />
          </motion.button>
          <motion.button
            onClick={() => setCashMode("withdraw")}
            aria-label="Withdraw cash"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-brand-light hover:brightness-125 cursor-pointer"
            whileTap={{ scale: 0.88 }}
            transition={{ duration: 0.12 }}
          >
            <ArrowUpFromLine size={17} />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {cashMode && <CashSheet mode={cashMode} onClose={() => setCashMode(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {profile.experience === "new" && !profile.tipsDismissed && (
          <GettingStartedCard
            goal={profile.goal}
            onOpenDeposit={() => setCashMode("deposit")}
            onDismiss={dismissTips}
          />
        )}
      </AnimatePresence>

      <section className="mt-8">
        <h2 className="px-4 pb-1 text-lg font-semibold text-ink lg:px-6">
          Investing
        </h2>
        <div className="px-2 lg:px-4">
          {holdings.length === 0 && (
            <p className="px-2 py-6 text-sm text-ink-faint">
              You don't own any stocks yet. Search to make your first trade.
            </p>
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
            <h2 className="text-lg font-semibold text-ink">Watchlist</h2>
            <Link to="/lists" className="text-sm font-medium text-brand-light hover:brightness-125">
              See all
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
