import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Bell,
  ChevronRight,
  CloudOff,
  FileText,
  FlaskConical,
  HelpCircle,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldCheck,
  User,
} from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { useAuth } from "../context/AuthContext";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { formatCurrency, formatCurrencyPrecise, formatShares } from "../lib/format";
import type { OrderRecord, TransferRecord } from "../types";

const SYNC_LABEL: Record<string, string> = {
  local: "Saved on this device",
  saving: "Saving…",
  synced: "Synced to your account",
  error: "Sync error — will retry",
};

const SYNC_DOT: Record<string, string> = {
  local: "bg-ink-faint",
  saving: "bg-ink-faint animate-pulse",
  synced: "bg-brand",
  error: "bg-down",
};

const SETTINGS_ROWS = [
  { icon: Banknote, label: "Transfers & banking" },
  { icon: FileText, label: "Statements & history" },
  { icon: Bell, label: "Notifications" },
  { icon: ShieldCheck, label: "Security" },
  { icon: HelpCircle, label: "Help" },
];

type ActivityItem =
  | { kind: "order"; timestamp: number; data: OrderRecord }
  | { kind: "transfer"; timestamp: number; data: TransferRecord };

export function Account() {
  const { cash, equityValue, totalValue, orders, transfers, resetPortfolio, syncStatus } = usePortfolio();
  const { status, user, signOut, exitGuestMode } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const activity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [
      ...orders.map((o) => ({ kind: "order" as const, timestamp: o.timestamp, data: o })),
      ...transfers.map((t) => ({ kind: "transfer" as const, timestamp: t.timestamp, data: t })),
    ];
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, transfers]);

  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const avatarUrl = meta.avatar_url ?? meta.picture;
  const displayName =
    status === "signed-in"
      ? meta.full_name ?? meta.name ?? user?.email?.split("@")[0] ?? "Account"
      : status === "guest"
        ? "Guest"
        : "Local practice";
  const displaySubtitle =
    status === "signed-in"
      ? user?.email
      : status === "guest"
        ? "Practicing locally — no account yet"
        : "Cloud sync not configured";

  return (
    <div className="pb-10">
      <div className="flex items-center gap-4 px-4 pt-6 lg:px-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full brand-gradient text-xl font-semibold text-white">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <User size={28} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-ink">{displayName}</div>
          <div className="truncate text-sm text-ink-faint">{displaySubtitle}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              <FlaskConical size={11} />
              Paper trading account
            </span>
            {status === "signed-in" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                <span className={`h-1.5 w-1.5 rounded-full ${SYNC_DOT[syncStatus]}`} />
                {SYNC_LABEL[syncStatus]}
              </span>
            )}
            {status === "unconfigured" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                <CloudOff size={11} />
                Local only
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-6 grid grid-cols-3 divide-x divide-border-soft rounded-2xl bg-surface-2 lg:mx-6">
        <div className="px-3 py-3.5 text-center">
          <div className="text-[12px] text-ink-faint">Total value</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {formatCurrency(totalValue)}
          </div>
        </div>
        <div className="px-3 py-3.5 text-center">
          <div className="text-[12px] text-ink-faint">Equity</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {formatCurrency(equityValue)}
          </div>
        </div>
        <div className="px-3 py-3.5 text-center">
          <div className="text-[12px] text-ink-faint">Cash</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">
            {formatCurrency(cash)}
          </div>
        </div>
      </div>

      <div className="mt-6 px-2 lg:px-4">
        {SETTINGS_ROWS.map((row) => (
          <motion.button
            key={row.label}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
            whileTap={{ scale: 0.98, backgroundColor: "var(--color-surface-2)" }}
            transition={{ duration: 0.12 }}
          >
            <row.icon size={20} className="text-ink-dim" />
            <span className="flex-1 text-[15px] text-ink">{row.label}</span>
            <ChevronRight size={18} className="text-ink-faint" />
          </motion.button>
        ))}
        <motion.button
          onClick={() => setShowResetConfirm(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
          whileTap={{ scale: 0.98, backgroundColor: "var(--color-surface-2)" }}
          transition={{ duration: 0.12 }}
        >
          <RotateCcw size={20} className="text-ink-dim" />
          <span className="flex-1 text-[15px] text-ink">Reset practice portfolio</span>
          <ChevronRight size={18} className="text-ink-faint" />
        </motion.button>
        {status === "signed-in" && (
          <motion.button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
            whileTap={{ scale: 0.98, backgroundColor: "var(--color-surface-2)" }}
            transition={{ duration: 0.12 }}
          >
            <LogOut size={20} className="text-down" />
            <span className="flex-1 text-[15px] text-down">Sign out</span>
          </motion.button>
        )}
        {status === "guest" && (
          <motion.button
            onClick={() => exitGuestMode()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
            whileTap={{ scale: 0.98, backgroundColor: "var(--color-surface-2)" }}
            transition={{ duration: 0.12 }}
          >
            <LogIn size={20} className="text-brand-light" />
            <span className="flex-1 text-[15px] text-brand-light">Log in or create an account</span>
            <ChevronRight size={18} className="text-ink-faint" />
          </motion.button>
        )}
      </div>

      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">Activity</h2>
        {activity.length === 0 && (
          <p className="mt-2 text-sm text-ink-faint">
            Trades and transfers will show up here.
          </p>
        )}
        <div className="mt-2 flex flex-col divide-y divide-border-soft">
          {activity.map((item) => (
            <div key={item.data.id} className="flex items-center gap-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
                {item.kind === "transfer" ? (
                  item.data.type === "deposit" ? (
                    <ArrowDownToLine size={15} />
                  ) : (
                    <ArrowUpFromLine size={15} />
                  )
                ) : item.data.side === "buy" ? (
                  <ArrowDownToLine size={15} />
                ) : (
                  <ArrowUpFromLine size={15} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-ink">
                  {item.kind === "transfer" ? (
                    item.data.type === "deposit" ? "Added cash" : "Withdrew cash"
                  ) : (
                    <>
                      <span className={item.data.side === "buy" ? "text-up" : "text-down"}>
                        {item.data.side === "buy" ? "Bought" : "Sold"}
                      </span>{" "}
                      {item.data.symbol}
                    </>
                  )}
                </div>
                <div className="text-[13px] text-ink-faint">
                  {item.kind === "order" &&
                    `${formatShares(item.data.shares)} sh @ ${formatCurrencyPrecise(item.data.price)} · `}
                  {new Date(item.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="text-[14px] font-medium tabular-nums text-ink">
                {item.kind === "transfer" && item.data.type === "withdraw" ? "-" : ""}
                {formatCurrency(item.kind === "transfer" ? item.data.amount : item.data.total)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showResetConfirm && (
          <ConfirmSheet
            title="Reset practice portfolio?"
            description="This clears your holdings, cash, watchlist, and activity back to the starting practice balance. This can't be undone."
            confirmLabel="Reset portfolio"
            danger
            onConfirm={() => {
              resetPortfolio();
              setShowResetConfirm(false);
            }}
            onClose={() => setShowResetConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
