import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { LessonSheet, type LessonId } from "../components/LessonSheet";
import { useLocale } from "../context/LocaleContext";

const STORAGE_KEY = "arvo.lessons.v1";
const LESSON_IDS: LessonId[] = [1, 2, 3];

interface LessonProgress {
  step: number;
  completed: boolean;
}
type ProgressMap = Record<LessonId, LessonProgress>;

function loadProgress(): ProgressMap {
  const base: ProgressMap = { 1: { step: 0, completed: false }, 2: { step: 0, completed: false }, 3: { step: 0, completed: false } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProgressMap>;
      for (const id of LESSON_IDS) {
        if (parsed[id]) base[id] = { step: parsed[id]!.step ?? 0, completed: !!parsed[id]!.completed };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return base;
}

function saveProgress(progress: ProgressMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function LessonsPage() {
  const { t } = useLocale();
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  const [openLesson, setOpenLesson] = useState<LessonId | null>(null);

  const updateStep = (id: LessonId, step: number) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: { ...prev[id], step } };
      saveProgress(next);
      return next;
    });
  };

  const markCompleted = (id: LessonId) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: { step: 4, completed: true } };
      saveProgress(next);
      return next;
    });
    setOpenLesson(null);
  };

  const lessonMeta = (id: LessonId) => ({
    title: t(`lessons.lesson${id}Title`),
    subtitle: t(`lessons.lesson${id}Subtitle`),
  });

  return (
    <div className="pb-10">
      <PageHeader title={t("lessons.pageTitle")} back />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("lessons.pageSubtitle")}</p>

      <div className="mt-2 flex flex-col gap-3 px-4 lg:px-6">
        {LESSON_IDS.map((id) => {
          const meta = lessonMeta(id);
          const p = progress[id];
          return (
            <div key={id} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-ink-dim">
                {p.completed ? <CheckCircle2 size={18} className="text-up" /> : <GraduationCap size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">{meta.title}</div>
                <div className="text-[12px] text-ink-faint">{meta.subtitle}</div>
                {p.completed && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-up-soft px-2 py-0.5 text-[10px] font-semibold text-up">
                    {t("lessons.completedBadge")}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpenLesson(id)}
                className="shrink-0 rounded-full border border-border px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-surface-3 cursor-pointer"
              >
                {p.completed ? t("lessons.reviewAgain") : p.step > 0 ? t("lessons.resumeLesson") : t("lessons.startLesson")}
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {openLesson && (
          <LessonSheet
            lessonId={openLesson}
            initialStep={progress[openLesson].completed ? 0 : progress[openLesson].step}
            onClose={() => setOpenLesson(null)}
            onComplete={() => markCompleted(openLesson)}
            onProgress={(step) => updateStep(openLesson, step)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
