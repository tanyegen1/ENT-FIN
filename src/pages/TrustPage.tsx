import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Laptop,
  Shield,
  Smartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "../components/PageHeader";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { useLocale } from "../context/LocaleContext";
import { useAuth } from "../context/AuthContext";
import { usePortfolio } from "../context/PortfolioContext";
import { useGoals } from "../context/GoalsContext";
import { useLists } from "../context/ListsContext";
import { useRecurring } from "../context/RecurringContext";
import { useSupport } from "../context/SupportContext";
import { useNotifications } from "../context/NotificationsContext";
import { usePriceAlerts } from "../context/PriceAlertsContext";
import { useSessions } from "../context/SessionsContext";
import { usePreferences } from "../context/PreferencesContext";
import { downloadTextFile } from "../lib/downloadFile";

const SHEET_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

const CLOSE_ACCOUNT_KEYS = [
  "arvo.goals.v1",
  "arvo.customLists.v1",
  "arvo.recurring.v1",
  "arvo.support.v1",
  "arvo.notifications.v1",
  "arvo.notificationPrefs.v1",
  "arvo.priceAlerts.v1",
  "arvo.sessions.v1",
  "arvo.onboarding.v1",
  "arvo.recentSearches",
];

function QACard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4">
      <h3 className="text-[15px] font-semibold text-ink">{heading}</h3>
      <div className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed text-ink-dim">{children}</div>
    </div>
  );
}

function PlaceholderNote({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="flex gap-2 rounded-lg border border-dashed border-border bg-surface-3 px-3 py-2 text-[12px] leading-relaxed text-ink-faint">
      <span className="h-fit shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
        {t("trust.placeholderTag")}
      </span>
      <span>{children}</span>
    </div>
  );
}

export function TrustPage() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { status, signOut, exitGuestMode, updatePassword } = useAuth();
  const portfolio = usePortfolio();
  const { goals } = useGoals();
  const { lists } = useLists();
  const { plans } = useRecurring();
  const { tickets } = useSupport();
  const { notifications, preferences } = useNotifications();
  const { alerts } = usePriceAlerts();
  const { sessions, signOutSession, signOutAllOthers } = useSessions();
  const { hideBalances, toggleHideBalances } = usePreferences();

  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [exported, setExported] = useState(false);
  const [confirmingSignOutAll, setConfirmingSignOutAll] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);

  const otherSessions = sessions.filter((s) => !s.current);

  const handlePasswordSubmit = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError(t("login.errorPasswordTooShort"));
      return;
    }
    const result = await updatePassword(newPassword);
    if (result.error) {
      setPasswordError(result.error);
      return;
    }
    setPasswordSaved(true);
    setNewPassword("");
    setChangingPassword(false);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      portfolio: {
        cash: portfolio.cash,
        holdings: portfolio.holdings,
        watchlist: portfolio.watchlist,
        orders: portfolio.orders,
        transfers: portfolio.transfers,
      },
      goals,
      lists,
      recurringPlans: plans,
      supportTickets: tickets,
      notifications: { items: notifications, preferences },
      priceAlerts: alerts,
    };
    downloadTextFile(`arvo-account-export-${Date.now()}.json`, JSON.stringify(payload, null, 2));
    setExported(true);
  };

  const handleCloseAccount = async () => {
    portfolio.resetPortfolio();
    for (const key of CLOSE_ACCOUNT_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    if (status === "signed-in") await signOut();
    else if (status === "guest") exitGuestMode();
    window.location.reload();
  };

  return (
    <div className="pb-10">
      <PageHeader title={t("trust.title")} back />
      <p className="px-4 pt-3 text-[13px] text-ink-faint lg:px-6">{t("trust.subtitle")}</p>

      <div className="mx-4 mt-4 rounded-2xl bg-brand-soft px-4 py-3.5 text-[13px] leading-relaxed text-ink-dim lg:mx-6">
        {t("trust.demoBanner")}
      </div>

      <div className="mt-6 flex flex-col gap-3 px-4 lg:px-6">
        <QACard heading={t("trust.qProviderHeading")}>
          <div className="flex items-center gap-2">
            <Building2 size={15} className="shrink-0 text-ink-faint" />
            <span>{t("trust.qProviderAnswer")}</span>
          </div>
          <PlaceholderNote>{t("trust.qProviderPlaceholder")}</PlaceholderNote>
        </QACard>

        <QACard heading={t("trust.qCustodyHeading")}>
          <div className="flex items-center gap-2">
            <Landmark size={15} className="shrink-0 text-ink-faint" />
            <span>{t("trust.qCustodyAnswer")}</span>
          </div>
          <PlaceholderNote>{t("trust.qCustodyPlaceholder")}</PlaceholderNote>
        </QACard>

        <QACard heading={t("trust.qFeesHeading")}>
          <p>{t("trust.qFeesIntro")}</p>
          <div className="mt-1 flex flex-col divide-y divide-border-soft rounded-xl bg-surface-3 px-3">
            {[
              [t("trust.feeTrading"), t("trust.feeTradingValue")],
              [t("trust.feeRecurring"), t("trust.feeRecurringValue")],
              [t("trust.feeTransfer"), t("trust.feeTransferValue")],
              [t("trust.feeCurrency"), t("trust.feeCurrencyValue")],
              [t("trust.feeAccount"), t("trust.feeAccountValue")],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-[13px]">
                <span className="text-ink-faint">{label}</span>
                <span className="font-medium text-ink">{value}</span>
              </div>
            ))}
          </div>
          <PlaceholderNote>{t("trust.feesPlaceholder")}</PlaceholderNote>
        </QACard>

        <QACard heading={t("trust.qProtectionHeading")}>
          <div className="flex items-center gap-2">
            <Shield size={15} className="shrink-0 text-ink-faint" />
            <span>{t("trust.qProtectionAnswer")}</span>
          </div>
          <PlaceholderNote>{t("trust.qProtectionPlaceholder")}</PlaceholderNote>
        </QACard>

        <QACard heading={t("trust.qControlsHeading")}>
          <p>{t("trust.qControlsAnswer")}</p>
        </QACard>
      </div>

      {/* Notifications */}
      <section className="mt-6 px-4 lg:px-6">
        <button
          onClick={() => navigate("/notifications")}
          className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3.5 text-left hover:bg-surface-3 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-ink">{t("trust.notificationsRow")}</div>
            <div className="text-[12px] text-ink-faint">{t("trust.notificationsRowNote")}</div>
          </div>
        </button>
      </section>

      {/* Devices & sessions */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("trust.sessionsHeading")}</h2>
        <p className="mt-1 text-[12px] text-ink-faint">{t("trust.sessionsNote")}</p>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
            <Laptop size={18} className="shrink-0 text-ink-dim" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{t("trust.sessionCurrent")}</div>
              <div className="text-[12px] text-ink-faint">{t("trust.lastActive", { when: t("common.now") })}</div>
            </div>
            <span className="shrink-0 rounded-full bg-up-soft px-2.5 py-1 text-[11px] font-semibold text-up">
              {t("trust.sessionActiveBadge")}
            </span>
          </div>
          {otherSessions.length === 0 ? (
            <p className="px-1 py-1 text-[13px] text-ink-faint">{t("trust.sessionsEmpty")}</p>
          ) : (
            otherSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
                <Smartphone size={18} className="shrink-0 text-ink-dim" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-ink">{s.device}</div>
                  <div className="truncate text-[12px] text-ink-faint">
                    {s.location} ·{" "}
                    {t("trust.lastActive", {
                      when: new Date(s.lastActiveAt).toLocaleDateString(locale === "tr" ? "tr-TR" : undefined, {
                        month: "short",
                        day: "numeric",
                      }),
                    })}
                  </div>
                </div>
                <button
                  onClick={() => signOutSession(s.id)}
                  className="shrink-0 text-[12px] font-semibold text-down hover:brightness-125 cursor-pointer"
                >
                  {t("trust.sessionSignOut")}
                </button>
              </div>
            ))
          )}
          {otherSessions.length > 0 && (
            <button
              onClick={() => setConfirmingSignOutAll(true)}
              className="mt-1 w-full rounded-full border border-border py-2.5 text-[13px] font-semibold text-down hover:bg-down-soft cursor-pointer"
            >
              {t("trust.sessionSignOutAll")}
            </button>
          )}
        </div>
      </section>

      {/* Sign-in & password */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("trust.securityHeading")}</h2>
        <div className="mt-3 rounded-xl bg-surface-2 px-3.5 py-3.5">
          {status === "signed-in" ? (
            <>
              <button
                onClick={() => {
                  setChangingPassword((v) => !v);
                  setPasswordSaved(false);
                  setPasswordError(null);
                }}
                className="flex w-full items-center gap-3 text-left cursor-pointer"
              >
                <KeyRound size={18} className="shrink-0 text-ink-dim" />
                <span className="flex-1 text-[14px] font-medium text-ink">{t("trust.changePassword")}</span>
              </button>
              <AnimatePresence initial={false}>
                {changingPassword && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex flex-col gap-2 border-t border-border-soft pt-3">
                      <label className="text-[12px] text-ink-faint" htmlFor="new-password">
                        {t("trust.newPasswordLabel")}
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface-3 px-3.5 py-3 text-[15px] text-ink focus:border-brand focus:outline-none"
                      />
                      {passwordError && <p className="text-[12px] text-down">{passwordError}</p>}
                      <button
                        onClick={handlePasswordSubmit}
                        className="mt-1 rounded-full brand-gradient py-2.5 text-[13px] font-semibold text-white hover:brightness-110 cursor-pointer"
                      >
                        {t("trust.changePasswordCta")}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {passwordSaved && <p className="mt-2 text-[12px] text-up">{t("trust.changePasswordSuccess")}</p>}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <KeyRound size={18} className="shrink-0 text-ink-faint" />
              <span className="text-[13px] text-ink-faint">
                {status === "guest" ? t("trust.changePasswordUnavailableGuest") : t("trust.changePasswordUnavailableCloud")}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Privacy */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("trust.privacyHeading")}</h2>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3.5">
          {hideBalances ? (
            <EyeOff size={18} className="shrink-0 text-ink-dim" />
          ) : (
            <Eye size={18} className="shrink-0 text-ink-dim" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-ink">{t("trust.hideBalancesLabel")}</div>
            <div className="text-[12px] text-ink-faint">{t("trust.hideBalancesNote")}</div>
          </div>
          <div className="relative flex shrink-0 rounded-full bg-surface-3 p-0.5">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                onClick={() => (hideBalances !== val ? toggleHideBalances() : undefined)}
                className={clsx(
                  "relative z-10 rounded-full px-3 py-1 text-[12px] font-semibold cursor-pointer",
                  hideBalances === val ? "bg-brand-soft text-brand-light" : "text-ink-faint",
                )}
              >
                {val ? t("notifications.instant") : t("notifications.off")}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Data & account */}
      <section className="mt-6 px-4 lg:px-6">
        <h2 className="text-[15px] font-semibold text-ink">{t("trust.dataHeading")}</h2>
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3.5 text-left hover:bg-surface-3 cursor-pointer"
          >
            <Download size={18} className="shrink-0 text-ink-dim" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{t("trust.exportData")}</div>
              <div className="text-[12px] text-ink-faint">
                {exported ? t("trust.exportDataDone") : t("trust.exportDataNote")}
              </div>
            </div>
          </button>
          <button
            onClick={() => setClosingAccount(true)}
            className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3.5 text-left hover:bg-down-soft cursor-pointer"
          >
            <TriangleAlert size={18} className="shrink-0 text-down" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-down">{t("trust.closeAccount")}</div>
              <div className="text-[12px] text-ink-faint">{t("trust.closeAccountNote")}</div>
            </div>
          </button>
        </div>
      </section>

      <AnimatePresence>
        {confirmingSignOutAll && (
          <ConfirmSheet
            title={t("trust.sessionSignOutAllConfirmTitle")}
            description={t("trust.sessionSignOutAllConfirmDesc")}
            confirmLabel={t("trust.sessionSignOutAllConfirmBtn")}
            danger
            onConfirm={() => {
              signOutAllOthers();
              setConfirmingSignOutAll(false);
            }}
            onClose={() => setConfirmingSignOutAll(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {closingAccount && (
          <CloseAccountSheet onClose={() => setClosingAccount(false)} onConfirm={handleCloseAccount} />
        )}
      </AnimatePresence>
    </div>
  );
}

interface CloseAccountSheetProps {
  onClose: () => void;
  onConfirm: () => void;
}

function CloseAccountSheet({ onClose, onConfirm }: CloseAccountSheetProps) {
  const { t } = useLocale();
  const [typed, setTyped] = useState("");
  const canConfirm = typed.trim().toUpperCase() === t("trust.closeAccountWord");

  return (
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
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-t-3xl border border-border-soft bg-surface px-6 py-6 lg:rounded-3xl"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={SHEET_SPRING}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-down-soft">
            <TriangleAlert size={22} className="text-down" />
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-dim hover:bg-surface-2 cursor-pointer"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div>
          <div className="text-lg font-semibold text-ink">{t("trust.closeAccountConfirmTitle")}</div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-faint">{t("trust.closeAccountConfirmDesc")}</p>
        </div>
        <div>
          <label className="text-[12px] text-ink-faint" htmlFor="close-account-confirm">
            {t("trust.closeAccountConfirmTypeLabel")}
          </label>
          <input
            id="close-account-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("trust.closeAccountConfirmPlaceholder")}
            autoCapitalize="characters"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-down focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <motion.button
            disabled={!canConfirm}
            onClick={onConfirm}
            whileTap={canConfirm ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.12 }}
            className={clsx(
              "w-full rounded-full py-3.5 text-[15px] font-semibold cursor-pointer",
              canConfirm ? "bg-down text-white hover:brightness-110" : "bg-surface-3 text-ink-faint cursor-not-allowed",
            )}
          >
            {t("trust.closeAccountConfirmBtn")}
          </motion.button>
          <button
            onClick={onClose}
            className="w-full rounded-full py-3.5 text-[15px] font-semibold text-ink-dim hover:bg-surface-2 cursor-pointer"
          >
            {t("common.cancel")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
