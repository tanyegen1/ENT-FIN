import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { Logo } from "../components/Logo";

type Mode = "login" | "signup";

export function Login() {
  const { signUpWithEmail, signInWithEmail, continueAsGuest } = useAuth();
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    const result =
      mode === "login" ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === "signup" && result.needsConfirmation) {
      setInfo(t("login.confirmEmailInfo"));
      setMode("login");
    }
    // If signup succeeded with no confirmation needed, onAuthStateChange
    // already flips us into the app — nothing further to do here.
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-app-bg px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px]"
      >
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-20 w-20 rounded-full blur-2xl"
              style={{ backgroundColor: "var(--color-brand)", opacity: 0.35 }}
            />
            <Logo size={36} />
          </div>
          <h1 className="text-2xl font-semibold text-ink">{t("login.title")}</h1>
          <p className="text-sm text-ink-faint">{t("login.subtitle")}</p>
        </div>

        <div className="relative mb-6 flex rounded-full bg-surface-2 p-1">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setInfo(null);
              }}
              className="relative flex-1 rounded-full py-2 text-[14px] font-semibold cursor-pointer"
            >
              {mode === m && (
                <motion.div
                  layoutId="auth-mode-pill"
                  className="absolute inset-0 rounded-full bg-brand-soft"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 ${mode === m ? "text-brand-light" : "text-ink-faint"}`}>
                {m === "login" ? t("login.tabLogin") : t("login.tabSignup")}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-faint">
              {t("login.emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink-faint">
              {t("login.passwordLabel")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-3 pr-11 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink-dim cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === "signup" && (
              <p className="mt-1.5 text-[12px] text-ink-faint">{t("login.passwordHint")}</p>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[13px] font-medium text-down"
            >
              {error}
            </motion.p>
          )}
          {info && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[13px] font-medium text-up"
            >
              {info}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            className={`mt-1 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-faint disabled:shadow-none ${canSubmit ? "brand-gradient brand-glow hover:brightness-110" : ""}`}
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {mode === "login" ? t("login.submitLogin") : t("login.submitSignup")}
          </motion.button>
        </form>

        <button
          onClick={continueAsGuest}
          className="mt-6 w-full text-center text-[13px] font-medium text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink-dim cursor-pointer"
        >
          {t("login.guestCta")}
        </button>
      </motion.div>
    </div>
  );
}
