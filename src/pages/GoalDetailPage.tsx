import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { GoalContributeSheet } from "../components/GoalContributeSheet";
import { GoalProjection } from "../components/GoalProjection";
import { useLocale } from "../context/LocaleContext";
import { useGoals } from "../context/GoalsContext";
import { formatCurrency, formatSigned } from "../lib/format";

export function GoalDetailPage() {
  const { id = "" } = useParams();
  const { goals, contributedTotal, currentValue, deleteGoal } = useGoals();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [contributing, setContributing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const goal = goals.find((g) => g.id === id);
  if (!goal) return <Navigate to="/goals" replace />;

  const contributed = contributedTotal(goal);
  const value = currentValue(goal);
  const percent = goal.targetAmount > 0 ? Math.min(100, (value / goal.targetAmount) * 100) : 0;
  const diff = value - contributed;

  return (
    <div className="pb-10">
      <PageHeader title={goal.name} back />

      <div className="px-4 pt-4 lg:px-6">
        <div className="text-[13px] text-ink-faint">{t("goals.currentValue")}</div>
        <div className="text-3xl font-semibold tabular-nums text-ink">{formatCurrency(value)}</div>
        {Math.abs(diff) > 0.005 && (
          <div className={`text-[13px] font-medium ${diff >= 0 ? "text-up" : "text-down"}`}>
            {t("goals.sincePrefix", { amount: formatSigned(diff) })}
          </div>
        )}

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full brand-gradient" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-faint">
          <span>{t("goals.progressLabel", { percent: percent.toFixed(0) })}</span>
          <span>
            {t("goals.target")}: {formatCurrency(goal.targetAmount)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="text-[12px] text-ink-faint">{t("goals.contributed")}</div>
            <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{formatCurrency(contributed)}</div>
          </div>
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="text-[12px] text-ink-faint">{t("goals.target")}</div>
            <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
              {formatCurrency(goal.targetAmount)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">{t("goals.valueNote")}</p>

        <button
          onClick={() => setContributing(true)}
          className="mt-4 w-full rounded-full brand-gradient brand-glow py-3.5 text-[15px] font-semibold text-white hover:brightness-110 cursor-pointer"
        >
          {t("goals.contribute")}
        </button>

        <div className="mt-6">
          <GoalProjection currentValue={value} contributedTotal={contributed} />
        </div>

        <section className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">{t("goals.contributionsHeading")}</h2>
          {goal.contributions.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">{t("goals.contributionsEmpty")}</p>
          ) : (
            <div className="mt-2 flex flex-col divide-y divide-border-soft">
              {goal.contributions.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span className="text-ink-faint">
                    {new Date(c.timestamp).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-medium tabular-nums text-ink">+{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={() => setDeleting(true)}
          className="mt-8 w-full rounded-full py-3 text-[13px] font-semibold text-down hover:bg-down-soft cursor-pointer"
        >
          {t("goals.deleteGoal")}
        </button>
      </div>

      <AnimatePresence>
        {contributing && <GoalContributeSheet goal={goal} onClose={() => setContributing(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {deleting && (
          <ConfirmSheet
            title={t("goals.deleteConfirmTitle")}
            description={t("goals.deleteConfirmDesc", { name: goal.name })}
            confirmLabel={t("goals.deleteConfirmBtn")}
            danger
            onConfirm={() => {
              deleteGoal(goal.id);
              navigate("/goals");
            }}
            onClose={() => setDeleting(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
