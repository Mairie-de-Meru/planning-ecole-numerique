import type { ReactNode } from "react";
import { Brand } from "./brand";
import { cx } from "./ui";

/** Mise en page « cahier » pour les écrans hors connexion (connexion, confirmation). */
export function NotebookPage({ appName, children, aside }: { appName: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className={cx("w-full", aside ? "max-w-4xl" : "max-w-md")}>
        <div className="mb-8 flex justify-center">
          <Brand name={appName} />
        </div>
        <div className={cx("overflow-hidden rounded-3xl border-2 border-line bg-surface shadow-card", aside && "md:grid md:grid-cols-[1.05fr_1fr]")}>
          {aside && <div className="seyes border-b-2 border-line py-8 pl-14 pr-8 md:border-b-0 md:border-r-2">{aside}</div>}
          <div className="p-7 sm:p-9">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function Steps() {
  const steps = [
    { n: 1, text: "Je choisis une valise dans le planning", c: "#3563d9" },
    { n: 2, text: "Je choisis une période libre", c: "#e4572e" },
    { n: 3, text: "Je confirme par e-mail : c'est réservé !", c: "#3f9d52" },
  ];
  return (
    <>
      <p className="font-hand text-5xl leading-[64px] text-accent">Bonjour !</p>
      <p className="text-[15px] font-semibold leading-8 text-ink-2">Réservez le matériel pédagogique de votre école en trois étapes.</p>
      <ol className="mt-0">
        {steps.map((s) => (
          <li key={s.n} className="flex items-center gap-3 text-[15px] font-bold leading-8">
            <span className="grid size-6 shrink-0 -rotate-3 place-items-center rounded-md text-xs font-extrabold text-white" style={{ background: s.c }}>
              {s.n}
            </span>
            {s.text}
          </li>
        ))}
      </ol>
      <p className="mt-0 font-hand text-2xl leading-8 text-margin">La valise est livrée à l&apos;école.</p>
    </>
  );
}
