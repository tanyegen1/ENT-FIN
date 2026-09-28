import { usePreferences } from "../context/PreferencesContext";

/** Wraps an already-formatted amount string and masks it when the user has hidden balances. */
export function MaskedAmount({ children }: { children: string }) {
  const { hideBalances } = usePreferences();
  return <>{hideBalances ? "••••" : children}</>;
}
