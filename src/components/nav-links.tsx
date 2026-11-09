"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function NavLinks({ links, exactRoots = ["/", "/admin"] }: { links: { href: string; label: string }[]; exactRoots?: string[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = exactRoots.includes(l.href) ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
              active ? "bg-highlight text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
