import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./ui";

/** Panneau dépliable sans JavaScript (<details>). */
export function Disclosure({ summary, children, className, defaultOpen }: { summary: ReactNode; children: ReactNode; className?: string; defaultOpen?: boolean }) {
  return (
    <details className={cx("group rounded-2xl border border-line bg-surface shadow-card", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}
