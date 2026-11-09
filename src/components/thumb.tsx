import { MalletteGlyph } from "./brand";
import { cx } from "./ui";

/** Vignette d'une mallette : sa photo, ou à défaut le pictogramme dans sa couleur. */
export function Thumb({ src, color, alt, className }: { src?: string | null; color: string; alt: string; className?: string }) {
  return (
    <span
      className={cx("relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white", className)}
      style={src ? undefined : { background: `color-mix(in srgb, ${color} 14%, var(--surface))`, borderColor: "transparent" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 size-full object-contain p-[8%]" />
      ) : (
        <MalletteGlyph className="w-1/2 max-w-20" color={color} />
      )}
    </span>
  );
}
