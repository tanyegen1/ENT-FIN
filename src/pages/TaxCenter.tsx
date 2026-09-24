import { useState } from "react";
import { motion } from "motion/react";
import { Bell, Check, Download, TriangleAlert } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatCurrency } from "../lib/format";
import { downloadTextFile } from "../lib/downloadFile";

const SAMPLE_YEAR = "2025";
const REALIZED_SHORT_TERM = 412.3;
const REALIZED_LONG_TERM = 1205.8;
const DIVIDEND_INCOME = 142.18;

const REVIEWED_KEY = "arvo.taxCenter.reviewedAt";
const CHECKLIST_KEY = "arvo.taxCenter.checklist";
const REMINDER_KEY = "arvo.taxCenter.reminder";

type DocStatus = "available" | "action" | "completed";

function loadBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore — preference just won't persist
  }
}

function loadReviewedAt(): number | null {
  try {
    const raw = localStorage.getItem(REVIEWED_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function saveReviewedAt(timestamp: number) {
  try {
    localStorage.setItem(REVIEWED_KEY, String(timestamp));
  } catch {
    // ignore — preference just won't persist
  }
}

function loadChecklist(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupted storage
  }
  return {};
}

function saveChecklist(state: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

type TFunc = (path: string, vars?: Record<string, string | number>) => string;

function buildSampleFile(t: TFunc, title: string, lines: string[]): string {
  return [
    t("taxCenter.docFileTitle"),
    t("taxCenter.docFileDisclaimer1"),
    t("taxCenter.docFileDisclaimer2"),
    "",
    title,
    "=".repeat(title.length),
    "",
    ...lines,
    "",
    t("taxCenter.docFileDisclaimer3"),
  ].join("\n");
}

function StatusBadge({ status }: { status: DocStatus }) {
  const { t } = useLocale();
  const styles: Record<DocStatus, string> = {
    available: "bg-brand-soft text-brand-light",
    action: "bg-down-soft text-down",
    completed: "bg-up-soft text-up",
  };
  const labels: Record<DocStatus, string> = {
    available: t("taxCenter.statusAvailable"),
    action: t("taxCenter.statusAction"),
    completed: t("taxCenter.statusCompleted"),
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function TaxCenter() {
  const { t, locale } = useLocale();
  const { formatDisplay } = useCurrency();
  const [reviewedAt, setReviewedAt] = useState<number | null>(loadReviewedAt);
  const reviewed = reviewedAt !== null;
  const [checklist, setChecklist] = useState<Record<string, boolean>>(loadChecklist);
  const [reminderOn, setReminderOn] = useState(loadBool(REMINDER_KEY));

  const totalRealized = REALIZED_SHORT_TERM + REALIZED_LONG_TERM;

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecklist(next);
      return next;
    });
  };

  const toggleReminder = () => {
    setReminderOn((prev) => {
      const next = !prev;
      saveBool(REMINDER_KEY, next);
      return next;
    });
  };

  const markReviewed = () => {
    const now = Date.now();
    setReviewedAt(now);
    saveReviewedAt(now);
  };

  const downloadDoc = (title: string, lines: string[], filename: string) => {
    downloadTextFile(filename, buildSampleFile(t, title, lines));
  };

  const checklistItems = [
    { id: "1", text: t("taxCenter.checklistItem1") },
    { id: "2", text: t("taxCenter.checklistItem2") },
    { id: "3", text: t("taxCenter.checklistItem3") },
    { id: "4", text: t("taxCenter.checklistItem4") },
    { id: "5", text: t("taxCenter.checklistItem5") },
  ];

  return (
    <div className="pb-10">
      <PageHeader title={t("taxCenter.title")} back />

      <div className="mx-4 mt-4 flex gap-3 rounded-2xl bg-down-soft px-4 py-3.5 lg:mx-6">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-down" />
        <div>
          <div className="text-[14px] font-semibold text-ink">{t("taxCenter.bannerTitle")}</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{t("taxCenter.bannerBody")}</p>
        </div>
      </div>

      <div className="mt-6 px-4 lg:px-6">
        <h1 className="text-lg font-semibold text-ink">{t("taxCenter.yearLabel", { year: SAMPLE_YEAR })}</h1>
      </div>

      {/* Realized gains and losses */}
      <section className="mt-4 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("taxCenter.realizedGainsHeading")}</h2>
        <div className="mt-3 grid grid-cols-3 divide-x divide-border-soft rounded-2xl bg-surface-2">
          <div className="px-3 py-3.5 text-center">
            <div className="text-[12px] text-ink-faint">{t("taxCenter.shortTerm")}</div>
            <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-up">
              +{formatDisplay(REALIZED_SHORT_TERM)}
            </div>
          </div>
          <div className="px-3 py-3.5 text-center">
            <div className="text-[12px] text-ink-faint">{t("taxCenter.longTerm")}</div>
            <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-up">
              +{formatDisplay(REALIZED_LONG_TERM)}
            </div>
          </div>
          <div className="px-3 py-3.5 text-center">
            <div className="text-[12px] text-ink-faint">{t("taxCenter.totalRealized")}</div>
            <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-up">
              +{formatDisplay(totalRealized)}
            </div>
          </div>
        </div>
      </section>

      {/* Dividend income */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("taxCenter.dividendHeading")}</h2>
        <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3.5">
          <div className="text-[20px] font-semibold tabular-nums text-ink">{formatDisplay(DIVIDEND_INCOME)}</div>
          <p className="mt-1 text-[12px] text-ink-faint">{t("taxCenter.dividendNote")}</p>
        </div>
      </section>

      {/* Documents */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("taxCenter.documentsHeading")}</h2>
        <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.documentsNote")}</p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-medium text-ink">{t("taxCenter.doc1099bName")}</div>
              <StatusBadge status="available" />
            </div>
            <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.doc1099bDesc")}</p>
            <button
              onClick={() =>
                downloadDoc(
                  t("taxCenter.doc1099bName"),
                  [
                    `${t("taxCenter.shortTerm")}: +${formatCurrency(REALIZED_SHORT_TERM)}`,
                    `${t("taxCenter.longTerm")}: +${formatCurrency(REALIZED_LONG_TERM)}`,
                    `${t("taxCenter.totalRealized")}: +${formatCurrency(totalRealized)}`,
                  ],
                  "arvo-sample-1099b.txt",
                )
              }
              className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
            >
              <Download size={14} /> {t("taxCenter.download")}
            </button>
          </div>

          <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-medium text-ink">{t("taxCenter.doc1099divName")}</div>
              <StatusBadge status="available" />
            </div>
            <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.doc1099divDesc")}</p>
            <button
              onClick={() =>
                downloadDoc(
                  t("taxCenter.doc1099divName"),
                  [`${t("taxCenter.dividendHeading")}: ${formatCurrency(DIVIDEND_INCOME)}`],
                  "arvo-sample-1099div.txt",
                )
              }
              className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
            >
              <Download size={14} /> {t("taxCenter.download")}
            </button>
          </div>

          <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-medium text-ink">{t("taxCenter.docCostBasisName")}</div>
              <StatusBadge status="action" />
            </div>
            <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.docCostBasisDesc")}</p>
          </div>

          <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-medium text-ink">{t("taxCenter.docAnnualName")}</div>
              <StatusBadge status={reviewed ? "completed" : "action"} />
            </div>
            <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.docAnnualDesc")}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <button
                onClick={() =>
                  downloadDoc(
                    t("taxCenter.docAnnualName"),
                    [
                      `${t("taxCenter.shortTerm")}: +${formatCurrency(REALIZED_SHORT_TERM)}`,
                      `${t("taxCenter.longTerm")}: +${formatCurrency(REALIZED_LONG_TERM)}`,
                      `${t("taxCenter.dividendHeading")}: ${formatCurrency(DIVIDEND_INCOME)}`,
                    ],
                    "arvo-sample-annual-statement.txt",
                  )
                }
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-light hover:brightness-125 cursor-pointer"
              >
                <Download size={14} /> {t("taxCenter.download")}
              </button>
              {!reviewed && (
                <motion.button
                  onClick={markReviewed}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-dim hover:text-ink cursor-pointer"
                >
                  <Check size={14} /> {t("taxCenter.markReviewed")}
                </motion.button>
              )}
            </div>
            {reviewedAt !== null && (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {t("taxCenter.reviewedOn", {
                  date: new Date(reviewedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Checklist */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("taxCenter.checklistHeading")}</h2>
        <p className="mt-1 text-[13px] text-ink-faint">{t("taxCenter.checklistNote")}</p>
        <div className="mt-3 flex flex-col gap-2">
          {checklistItems.map((item) => {
            const done = !!checklist[item.id];
            return (
              <button
                key={item.id}
                onClick={() => toggleChecklist(item.id)}
                className="flex items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3 text-left cursor-pointer"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-brand bg-brand text-white" : "border-border text-transparent"
                  }`}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className={`text-[14px] leading-snug ${done ? "text-ink-faint line-through" : "text-ink"}`}>
                  {item.text}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reminders */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("taxCenter.reminderHeading")}</h2>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Bell size={18} className="text-ink-dim" />
            <span className="text-[14px] text-ink">{t("taxCenter.reminderToggle")}</span>
          </div>
          <button
            onClick={toggleReminder}
            aria-pressed={reminderOn}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
              reminderOn ? "bg-brand" : "bg-surface-3"
            }`}
          >
            <motion.span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
              animate={{ left: reminderOn ? 22 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          </button>
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">
          {reminderOn ? t("taxCenter.reminderOnNote") : t("taxCenter.reminderOffNote")}
        </p>
      </section>
    </div>
  );
}
