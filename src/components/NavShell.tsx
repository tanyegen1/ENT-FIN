import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { House, Search, ListChecks, CircleUser } from "lucide-react";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/search", label: "Search", icon: Search, end: false },
  { to: "/lists", label: "Lists", icon: ListChecks, end: false },
  { to: "/account", label: "Account", icon: CircleUser, end: false },
];

export function NavShell() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1100px] bg-app-bg">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-[220px] shrink-0 flex-col border-r border-border-soft px-3 py-5 lg:flex">
        <div className="flex items-center gap-2 px-3 pb-8">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-ink">Pulse</span>
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
                    ? "bg-surface-2 text-ink"
                    : "text-ink-dim hover:bg-surface-2 hover:text-ink",
                )
              }
            >
              <item.icon size={22} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-h-svh w-full flex-1 pb-20 lg:pb-0">
        <Outlet />
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
                isActive ? "text-ink" : "text-ink-faint",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
