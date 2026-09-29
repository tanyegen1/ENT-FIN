import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, an uncaught error anywhere in the tree unmounts the entire
 * app (React's default since v18) — the page goes fully blank with nothing
 * but a console error, and nothing short of a hard reload brings it back.
 * This scopes that failure to whatever it's wrapped around and shows the
 * actual error so it can be reported and fixed, instead of a dead screen.
 *
 * In NavShell, this sits inside the motion.div keyed by location.pathname —
 * that key change already remounts everything below it on every navigation,
 * which is what clears a caught error when the user moves to another page;
 * no extra reset logic needed here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-lg font-semibold" style={{ color: "var(--color-ink)" }}>
            Something went wrong loading this page
          </div>
          <p className="max-w-sm text-sm" style={{ color: "var(--color-ink-faint)" }}>
            This is a practice app bug, not something you did — try going back or reloading.
          </p>
          <pre
            className="max-w-sm overflow-x-auto rounded-xl px-3 py-2 text-left text-[11px]"
            style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-down)" }}
          >
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold cursor-pointer"
            style={{ backgroundColor: "var(--color-brand)", color: "var(--color-brand-ink)" }}
          >
            <RefreshCw size={15} />
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
