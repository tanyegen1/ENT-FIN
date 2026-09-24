import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import clsx from "clsx";
import { House, Search, ListChecks, CircleUser, Globe } from "lucide-react";
import { Logo } from "./Logo";
import { LocaleCurrencySheet } from "./LocaleCurrencySheet";
import { useLocale } from "../context/LocaleContext";
import { useCurrency } from "../context/CurrencyContext";

const TAB_TRANSITION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

// A stock detail page "opens" — it expands into view rather than sliding
// like a tab switch, and folds back down on the way out.
const STOCK_OPEN_TRANSITION = {
  initial: { opacity: 0, scale: 0.96, y: 14 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 10 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

function getPageTransition(pathname: string) {
  return pathname.startsWith("/stock/") ? STOCK_OPEN_TRANSITION : TAB_TRANSITION;
}

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.home", icon: House, end: true },
  { to: "/search", labelKey: "nav.search", icon: Search, end: false },
  { to: "/lists", labelKey: "nav.lists", icon: ListChecks, end: false },
  { to: "/account", labelKey: "nav.account", icon: CircleUser, end: false },
];

export function NavShell() {
  const location = useLocation();
  const { locale, t } = useLocale();
  const { displayCurrency } = useCurrency();
  const [showLocaleSheet, setShowLocaleSheet] = useState(false);

  return (
    <LayoutGroup>
      <div className="mx-auto flex min-h-svh w-full max-w-[1100px] bg-app-bg">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-[220px] shrink-0 flex-col border-r border-border-soft px-3 py-5 lg:flex">
          <div className="flex items-center gap-2 px-3 pb-8">
            <Logo />
            <span className="text-lg font-semibold tracking-tight text-ink">Arvo</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                    isActive
                      ? "bg-brand-soft text-brand-light"
                      : "text-ink-dim hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <item.icon size={22} strokeWidth={2} />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => setShowLocaleSheet(true)}
            className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-faint hover:bg-surface-2 hover:text-ink-dim cursor-pointer"
          >
            <Globe size={18} />
            {locale.toUpperCase()} · {displayCurrency === "USD" ? "$" : "₺"}
          </button>
        </aside>

        {/* Main content */}
        <main className="min-h-svh w-full flex-1 overflow-x-hidden pb-20 lg:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} {...getPageTransition(location.pathname)}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border-soft bg-app-bg/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors",
                  isActive ? "text-brand-light" : "text-ink-faint",
                )
              }
            >
              {({ isActive }) => (
                <motion.span
                  className="flex flex-col items-center gap-0.5"
                  whileTap={{ scale: 0.88 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                  {t(item.labelKey)}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <AnimatePresence>
        {showLocaleSheet && <LocaleCurrencySheet onClose={() => setShowLocaleSheet(false)} />}
      </AnimatePresence>
    </LayoutGroup>
  );
}
