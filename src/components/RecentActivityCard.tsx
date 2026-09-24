import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { formatCurrency } from "../lib/format";
import type { OrderRecord, TransferRecord } from "../types";

type ActivityItem =
  | { kind: "order"; data: OrderRecord }
  | { kind: "transfer"; data: TransferRecord };

interface RecentActivityCardProps {
  item: ActivityItem;
}

export function RecentActivityCard({ item }: RecentActivityCardProps) {
  const { t } = useLocale();

  const label =
    item.kind === "transfer"
      ? item.data.type === "deposit"
        ? t("home.recentAdded")
        : t("home.recentWithdrew")
      : item.data.side === "buy"
        ? t("home.recentBought")
        : t("home.recentSold");

  const amount = item.kind === "transfer" ? item.data.amount : item.data.total;
  const isOutflow = item.kind === "transfer" && item.data.type === "withdraw";
  const Icon =
    item.kind === "transfer"
      ? item.data.type === "deposit"
        ? ArrowDownToLine
        : ArrowUpFromLine
      : item.data.side === "buy"
        ? ArrowDownToLine
        : ArrowUpFromLine;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mx-4 mt-4 overflow-hidden lg:mx-6"
    >
      <Link
        to="/account"
        className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 px-4 py-3.5 hover:bg-surface-3"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-dim">
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-faint">{t("home.recentActivityTitle")}</div>
          <div className="text-[14px] font-medium text-ink">
            {label}
            {item.kind === "order" ? ` ${item.data.symbol}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-[14px] font-medium tabular-nums text-ink">
          {isOutflow ? "-" : ""}
          {formatCurrency(amount)}
        </div>
      </Link>
    </motion.div>
  );
}
