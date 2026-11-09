import { Backpack } from "lucide-react";

export function Brand({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight text-ink">
      <span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-accent text-accent-ink shadow-[0_2px_0_color-mix(in_srgb,var(--accent)_60%,black)]">
        <Backpack className="size-[18px]" strokeWidth={2.2} />
      </span>
      {name}
    </span>
  );
}
