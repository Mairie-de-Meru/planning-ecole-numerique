import Link from "next/link";
import { cx } from "./ui";

export function YearTabs({ years, current, base }: { years: string[]; current: string; base: string }) {
  if (years.length < 2) return null;
  return (
    <div className="inline-flex rounded-xl border border-line-strong bg-surface p-1">
      {years.map((y) => (
        <Link
          key={y}
          href={`${base}?annee=${y}`}
          className={cx("rounded-lg px-3 py-1.5 text-sm font-bold", y === current ? "bg-ink text-surface" : "text-muted hover:text-ink")}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}
