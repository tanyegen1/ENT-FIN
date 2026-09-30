import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { InfoTip } from "./InfoTip";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

export interface ChartToolsState {
  highLow: boolean;
  prevClose: boolean;
  avgCost: boolean;
  myOrders: boolean;
  movingAverages: boolean;
  rsi: boolean;
}

export const DEFAULT_CHART_TOOLS: ChartToolsState = {
  highLow: false,
  prevClose: false,
  avgCost: false,
  myOrders: false,
  movingAverages: false,
  rsi: false,
};

interface ChartToolsSheetProps {
  state: ChartToolsState;
  onChange: (next: ChartToolsState) => void;
  onClose: () => void;
  /** Only shown when the current view actually has each thing to show. */
  availability: {
    prevClose: boolean;
    avgCost: boolean;
    myOrders: boolean;
    movingAverages: boolean;
  };
}

interface ToolRowProps {
  label: string;
  detail?: string;
  definition: ReactNode;
  checked: boolean;
  disabled?: boolean;
  disabledNote?: string;
  onToggle: () => void;
}

function ToolRow({ label, detail, definition, checked, disabled, disabledNote, onToggle }: ToolRowProps) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${disabled ? "opacity-50" : "hover:bg-surface-2 cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-brand disabled:cursor-not-allowed"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-medium text-ink">{label}</span>
          <InfoTip definition={definition} width={240} />
        </span>
        {(detail || (disabled && disabledNote)) && (
          <span className="text-[12px] text-ink-faint">{disabled ? disabledNote : detail}</span>
        )}
      </span>
    </label>
  );
}

/**
 * The "Chart tools" menu (spec section 9) — every tool here defaults off,
 * so the plain price line stays the uncluttered default. No predictive
 * arrows, AI price targets, or automatic buy/sell signals live here or
 * anywhere else in this menu.
 */
export function ChartToolsSheet({ state, onChange, onClose, availability }: ChartToolsSheetProps) {
  const { t } = useLocale();
  const set = (key: keyof ChartToolsState, value: boolean) => onChange({ ...state, [key]: value });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
        <motion.div
          className="relative z-10 flex max-h-[85svh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border-soft bg-surface lg:rounded-3xl"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={SHEET_SPRING}
        >
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
            <span className="text-[15px] font-semibold text-ink">{t("chart.toolsSheetTitle")}</span>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
              aria-label={t("common.close")}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto px-2 py-2">
            <ToolRow
              label={t("chart.toolHighLow")}
              detail={t("chart.toolHighLowDetail")}
              definition={t("chart.toolHighLowInfo")}
              checked={state.highLow}
              onToggle={() => set("highLow", !state.highLow)}
            />
            <ToolRow
              label={t("chart.toolPrevClose")}
              detail={t("chart.toolPrevCloseDetail")}
              definition={t("chart.toolPrevCloseInfo")}
              checked={state.prevClose}
              disabled={!availability.prevClose}
              disabledNote={t("chart.toolPrevCloseUnavailable")}
              onToggle={() => set("prevClose", !state.prevClose)}
            />
            <ToolRow
              label={t("chart.toolAvgCost")}
              detail={t("chart.toolAvgCostDetail")}
              definition={t("chart.toolAvgCostInfo")}
              checked={state.avgCost}
              disabled={!availability.avgCost}
              disabledNote={t("chart.toolAvgCostUnavailable")}
              onToggle={() => set("avgCost", !state.avgCost)}
            />
            <ToolRow
              label={t("chart.toolMyOrders")}
              detail={t("chart.toolMyOrdersDetail")}
              definition={t("chart.toolMyOrdersInfo")}
              checked={state.myOrders}
              disabled={!availability.myOrders}
              disabledNote={t("chart.toolMyOrdersUnavailable")}
              onToggle={() => set("myOrders", !state.myOrders)}
            />
            <ToolRow
              label={t("chart.toolMovingAverages")}
              detail={t("chart.toolMovingAveragesDetail")}
              definition={t("chart.toolMovingAveragesInfo")}
              checked={state.movingAverages}
              disabled={!availability.movingAverages}
              disabledNote={t("chart.toolMovingAveragesUnavailable")}
              onToggle={() => set("movingAverages", !state.movingAverages)}
            />

            <div className="mt-2 px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {t("chart.advancedHeading")}
            </div>
            <ToolRow
              label={t("chart.toolRsi")}
              detail={t("chart.toolRsiDetail")}
              definition={t("chart.toolRsiInfo")}
              checked={state.rsi}
              onToggle={() => set("rsi", !state.rsi)}
            />
          </div>

          <p className="border-t border-border-soft px-4 py-3 text-[11px] leading-relaxed text-ink-faint">
            {t("chart.toolsFooterNote")}
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
