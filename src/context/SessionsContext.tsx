import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { DeviceSession } from "../types";

const STORAGE_KEY = "arvo.sessions.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Fabricated so the "devices & sessions" list has something to show and sign
// out of — this prototype has no real server tracking multiple devices.
function defaultSessions(): DeviceSession[] {
  const now = Date.now();
  return [
    { id: "current", device: "This device", location: "Current session", lastActiveAt: now, current: true },
    {
      id: makeId(),
      device: "Chrome on Windows",
      location: "Istanbul, Turkey",
      lastActiveAt: now - 2 * 24 * 60 * 60 * 1000,
      current: false,
    },
    {
      id: makeId(),
      device: "Safari on iPhone",
      location: "Ankara, Turkey",
      lastActiveAt: now - 9 * 24 * 60 * 60 * 1000,
      current: false,
    },
  ];
}

function loadSessions(): DeviceSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.some((s) => s.current)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return defaultSessions();
}

function saveSessions(sessions: DeviceSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

interface SessionsContextValue {
  sessions: DeviceSession[];
  signOutSession: (id: string) => void;
  signOutAllOthers: () => void;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<DeviceSession[]>(loadSessions);

  const signOutSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.current || s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);

  const signOutAllOthers = useCallback(() => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.current);
      saveSessions(next);
      return next;
    });
  }, []);

  const value: SessionsContextValue = { sessions, signOutSession, signOutAllOthers };

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used within SessionsProvider");
  return ctx;
}
