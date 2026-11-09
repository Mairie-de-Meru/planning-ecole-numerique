import { Briefcase } from "lucide-react";

export function Brand({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
        <Briefcase className="size-4" strokeWidth={2.2} />
      </span>
      {name}
    </span>
  );
}
