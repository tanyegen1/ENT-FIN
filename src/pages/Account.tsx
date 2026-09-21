import {
  Banknote,
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import { usePortfolio } from "../context/PortfolioContext";
import { formatCurrency, formatCurrencyPrecise, formatShares } from "../lib/format";

const SETTINGS_ROWS = [
  { icon: Banknote, label: "Transfers & banking" },
  { icon: FileText, label: "Statements & history" },
  { icon: Bell, label: "Notifications" },
  { icon: ShieldCheck, label: "Security" },
  { icon: HelpCircle, label: "Help" },
];

export function Account() {
  const { cash, equityValue, totalValue, orders } = usePortfolio();

  return (
    <div className="pb-10">
      <div className="flex items-center gap-4 px-4 pt-6 lg:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-xl font-semibold text-ink">
          <User size={28} />
        </div>
        <div>
          <div className="text-lg font-semibold text-ink">Alex Morgan</div>
          <div className="text-sm text-ink-faint">alex.morgan@example.com</div>
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
          <button
            key={row.label}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer"
          >
            <row.icon size={20} className="text-ink-dim" />
            <span className="flex-1 text-[15px] text-ink">{row.label}</span>
            <ChevronRight size={18} className="text-ink-faint" />
          </button>
        ))}
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-surface-2 cursor-pointer">
          <LogOut size={20} className="text-down" />
          <span className="flex-1 text-[15px] text-down">Sign out</span>
        </button>
      </div>

      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-lg font-semibold text-ink">History</h2>
        {orders.length === 0 && (
          <p className="mt-2 text-sm text-ink-faint">
            Your order history will show up here.
          </p>
        )}
        <div className="mt-2 flex flex-col divide-y divide-border-soft">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-ink">
                  <span className={o.side === "buy" ? "text-up" : "text-down"}>
                    {o.side === "buy" ? "Bought" : "Sold"}
                  </span>{" "}
                  {o.symbol}
                </div>
                <div className="text-[13px] text-ink-faint">
                  {formatShares(o.shares)} sh @ {formatCurrencyPrecise(o.price)} ·{" "}
                  {new Date(o.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="text-[14px] font-medium tabular-nums text-ink">
                {formatCurrency(o.total)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
