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

const GUEST_KEY = "pulse.guestMode";

export type AuthStatus = "loading" | "unconfigured" | "signed-out" | "guest" | "signed-in";

interface AuthResult {
  error?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(message: string): string {
  if (/already registered/i.test(message)) return "That email already has an account — try logging in instead.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/password.*at least/i.test(message)) return "Password must be at least 6 characters.";
  if (/email.*invalid/i.test(message)) return "That doesn't look like a valid email address.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
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

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });

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

    return () => subscription.subscription.unsubscribe();
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
    if (!supabase) return { error: "Cloud sync isn't configured." };
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud sync isn't configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: "Cloud sync isn't configured." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return error ? { error: friendlyAuthError(error.message) } : {};
  }, []);

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
      signInWithGoogle,
      signOut,
      continueAsGuest,
      exitGuestMode,
    }),
    [status, user, signUpWithEmail, signInWithEmail, signInWithGoogle, signOut, continueAsGuest, exitGuestMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
