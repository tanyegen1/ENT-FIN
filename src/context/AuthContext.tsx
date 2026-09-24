import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { useLocale } from "./LocaleContext";

const GUEST_KEY = "arvo.guestMode";

export type AuthStatus = "loading" | "unconfigured" | "signed-out" | "guest" | "signed-in";

interface AuthResult {
  error?: string;
  /** Set when signup succeeded but Supabase requires clicking an email link before you can log in. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(message: string, t: (path: string) => string): string {
  if (/already registered/i.test(message)) return t("login.errorAlreadyRegistered");
  if (/invalid login credentials/i.test(message)) return t("login.errorInvalidCredentials");
  if (/password.*at least/i.test(message)) return t("login.errorPasswordTooShort");
  if (/email.*invalid/i.test(message)) return t("login.errorInvalidEmail");
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let settled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        settled = true;
        setUser(data.session?.user ?? null);
        setReady(true);
      })
      .catch(() => {
        // Network hiccup, bad URL, etc. — fall through to signed-out/guest
        // rather than leaving the app stuck on the loading screen forever.
        settled = true;
        setReady(true);
      });

    // Absolute fallback: never let a hung request block the app indefinitely.
    const timeout = setTimeout(() => {
      if (!settled) setReady(true);
    }, 6000);

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          localStorage.removeItem(GUEST_KEY);
        } catch {
          // ignore
        }
        setIsGuest(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const status: AuthStatus = !isSupabaseConfigured
    ? "unconfigured"
    : !ready
      ? "loading"
      : user
        ? "signed-in"
        : isGuest
          ? "guest"
          : "signed-out";

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: t("login.errorCloudUnavailable") };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: friendlyAuthError(error.message, t) };
    // If the project has "Confirm email" off, signUp already returns a live
    // session — onAuthStateChange picks it up and signs you in immediately.
    // Otherwise there's no session yet until the confirmation link is clicked.
    return { needsConfirmation: !data.session };
  }, [t]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: t("login.errorCloudUnavailable") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: friendlyAuthError(error.message, t) } : {};
  }, [t]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    try {
      localStorage.setItem(GUEST_KEY, "1");
    } catch {
      // ignore
    }
    setIsGuest(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      continueAsGuest,
      exitGuestMode,
    }),
    [status, user, signUpWithEmail, signInWithEmail, signOut, continueAsGuest, exitGuestMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
