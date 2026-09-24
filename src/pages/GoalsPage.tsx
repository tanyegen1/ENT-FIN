import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { Target } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { CreateGoalSheet } from "../components/CreateGoalSheet";
import { useLocale } from "../context/LocaleContext";
import { useGoals } from "../context/GoalsContext";
import { formatCurrency } from "../lib/format";

export function GoalsPage() {
  const { t } = useLocale();
  const { goals, currentValue } = useGoals();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <div className="pb-10">
      <PageHeader
        title={t("goals.title")}
        back
        right={
          <button
            onClick={() => setCreating(true)}
            className="text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
          >
            {t("goals.createCta")}
          </button>
        }
      />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("goals.subtitle")}</p>

      {goals.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
            <Target size={22} />
          </div>
          <p className="text-sm text-ink-faint">{t("goals.empty")}</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-2 rounded-full brand-gradient px-4 py-2 text-[13px] font-semibold text-white cursor-pointer"
          >
            {t("goals.createCta")}
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3 px-4 lg:px-6">
        {goals.map((goal) => {
          const value = currentValue(goal);
          const percent = goal.targetAmount > 0 ? Math.min(100, (value / goal.targetAmount) * 100) : 0;
          return (
            <Link
              key={goal.id}
              to={`/goals/${goal.id}`}
              className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4 hover:bg-surface-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-[15px] font-semibold text-ink">{goal.name}</div>
                <div className="shrink-0 text-[13px] font-medium tabular-nums text-ink-dim">
                  {formatCurrency(value)}
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full brand-gradient" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-faint">
                <span>{t("goals.progressLabel", { percent: percent.toFixed(0) })}</span>
                <span>
                  {t("goals.target")}: {formatCurrency(goal.targetAmount)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <AnimatePresence>
        {creating && (
          <CreateGoalSheet onClose={() => setCreating(false)} onCreated={(id) => navigate(`/goals/${id}`)} />
        )}
      </AnimatePresence>
    </div>
  );
}
