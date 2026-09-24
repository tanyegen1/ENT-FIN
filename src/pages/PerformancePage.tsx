import { useMemo, useState } from "react";
import clsx from "clsx";
import { PageHeader } from "../components/PageHeader";
import { usePortfolio } from "../context/PortfolioContext";
import { useLocale } from "../context/LocaleContext";
import { formatCurrency, formatPercent, formatSigned } from "../lib/format";

type View = "currency" | "percent";

interface Row {
  label: string;
  value: number;
  signed?: boolean;
}

export function PerformancePage() {
  const { holdings, cash, equityValue, transfers } = usePortfolio();
  const { t } = useLocale();
  const [view, setView] = useState<View>("currency");

  const moneyContributed = useMemo(
    () => transfers.filter((tr) => tr.type === "deposit").reduce((sum, tr) => sum + tr.amount, 0),
    [transfers],
  );
  const moneyWithdrawn = useMemo(
    () => transfers.filter((tr) => tr.type === "withdraw").reduce((sum, tr) => sum + tr.amount, 0),
    [transfers],
  );
  const costBasis = useMemo(() => holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0), [holdings]);
  const investmentGainLoss = equityValue - costBasis;
  const dividendsReceived = 0;
  const totalValue = equityValue + cash;

  // Money contributed isn't a safe percentage baseline: a sample account starts with
  // holdings and cash that were never "contributed" through a deposit, so a single small
  // deposit could make everything else read as an absurd percentage. Total balance is
  // never near-zero for a funded account and keeps every row a sane, bounded number.
  const hasBaseline = totalValue > 0.01;
  const percentOf = (value: number) => (hasBaseline ? (value / totalValue) * 100 : null);

  const rows: Row[] = [
    { label: t("performance.moneyContributed"), value: moneyContributed },
    { label: t("performance.moneyWithdrawn"), value: moneyWithdrawn },
    { label: t("performance.currentInvestedValue"), value: equityValue },
    { label: t("performance.availableCash"), value: cash },
    { label: t("performance.investmentGainLoss"), value: investmentGainLoss, signed: true },
    { label: t("performance.dividendsReceived"), value: dividendsReceived },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title={t("performance.title")}
        back
        right={
          <div className="relative flex rounded-full bg-surface-3 p-0.5">
            {([{ v: "currency", label: t("performance.viewCurrency") }, { v: "percent", label: t("performance.viewPercent") }] as const).map(
              (opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={clsx(
                    "relative z-10 rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer",
                    view === opt.v ? "bg-brand-soft text-brand-light" : "text-ink-faint",
                  )}
                >
                  {opt.label}
                </button>
              ),
            )}
          </div>
        }
      />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("performance.subtitle")}</p>

      <div className="mt-4 flex flex-col divide-y divide-border-soft px-4 lg:px-6">
        {rows.map((row) => {
          const percent = percentOf(row.value);
          let display: string;
          if (view === "currency") {
            display = row.signed ? formatSigned(row.value) : formatCurrency(row.value);
          } else if (percent === null) {
            display = "—";
          } else {
            display = row.signed ? formatPercent(percent) : `${percent.toFixed(1)}%`;
          }
          const colorClass = row.signed ? (row.value >= 0 ? "text-up" : "text-down") : "text-ink";
          return (
            <div key={row.label} className="flex items-center justify-between py-3">
              <span className="text-[14px] text-ink-dim">{row.label}</span>
              <span className={clsx("text-[15px] font-semibold tabular-nums", colorClass)}>{display}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 px-4 text-[12px] leading-relaxed text-ink-faint lg:px-6">
        {view === "percent" && !hasBaseline
          ? t("performance.percentUnavailable")
          : view === "percent"
            ? t("performance.percentBaselineNote")
            : t("performance.dividendsNote")}
      </p>

      <section className="mt-6 rounded-2xl bg-surface-2 mx-4 px-4 py-4 lg:mx-6">
        <h2 className="text-[14px] font-semibold text-ink">{t("performance.whyHeading")}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{t("performance.whyBody")}</p>
      </section>
    </div>
  );
}
