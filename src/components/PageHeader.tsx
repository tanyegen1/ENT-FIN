import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  back?: boolean;
  right?: ReactNode;
}

export function PageHeader({ title, back, right }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border-soft bg-app-bg/95 px-4 py-3 backdrop-blur">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-surface-2 cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <h1 className="flex-1 truncate text-[17px] font-semibold text-ink">{title}</h1>
      {right}
    </header>
  );
}
