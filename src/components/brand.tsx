/** Pictogramme « mallette » dessiné à la main (pas d'icône générique). */
export function MalletteGlyph({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M12 8.5V6.8C12 5.8 12.8 5 13.8 5h4.4c1 0 1.8.8 1.8 1.8v1.7" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="3.5" y="8.5" width="25" height="18.5" rx="3.2" fill={color} />
      <path d="M3.5 15.5h25" stroke="var(--surface)" strokeWidth="1.6" opacity=".55" />
      <rect x="13.6" y="13.2" width="4.8" height="4.6" rx="1.1" fill="var(--surface)" />
      <rect x="15.1" y="14.6" width="1.8" height="1.8" rx=".5" fill={color} />
    </svg>
  );
}

export function Brand({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-ink">
      <MalletteGlyph className="size-8 text-accent" />
      {name}
    </span>
  );
}
