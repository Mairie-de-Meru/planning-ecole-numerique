import type { ReactNode } from "react";
import { Brand } from "./brand";
import { Thumb } from "./thumb";
import { cx } from "./ui";

/** Mise en page « cahier » pour les écrans hors connexion (connexion, confirmation). */
export function NotebookPage({ appName, children, aside }: { appName: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className={cx("w-full", aside ? "max-w-4xl" : "max-w-md")}>
        <div className="mb-8 flex justify-center">
          <Brand name={appName} />
        </div>
        <div className={cx("overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-card", aside && "md:grid md:grid-cols-[1.05fr_1fr]")}>
          {aside && <div className="seyes border-b border-line py-8 pl-14 pr-8 md:border-b-0 md:border-r">{aside}</div>}
          <div className="p-7 sm:p-9">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function LoginAside({ items }: { items: { name: string; photoUrl: string | null; color: string }[] }) {
  return (
    <div className="flex h-full flex-col">
      <p className="font-hand text-[44px] leading-[64px] text-accent">Bonjour,</p>
      <p className="text-[15px] font-semibold leading-8 text-ink-2">
        réservez une mallette pour votre classe le temps d&apos;une période : elle est livrée à l&apos;école.
      </p>
      {items.length > 0 && (
        <ul className="mt-6 grid grid-cols-2 gap-3">
          {items.map((i) => (
            <li key={i.name} className="rounded-2xl border border-line bg-surface p-2 shadow-card">
              <Thumb src={i.photoUrl} color={i.color} alt={i.name} className="aspect-[4/3] w-full !border-0" />
              <p className="truncate px-1 pb-0.5 pt-1.5 text-[13px] font-bold text-ink">{i.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
