/** Couleurs « crayons » attribuées aux valises. */
export const CRAYONS = [
  { key: "encre", label: "Bleu encre", hex: "#3563d9" },
  { key: "tomate", label: "Tomate", hex: "#e4572e" },
  { key: "prairie", label: "Prairie", hex: "#3f9d52" },
  { key: "soleil", label: "Soleil", hex: "#e2a612" },
  { key: "lilas", label: "Lilas", hex: "#8b5cd6" },
  { key: "lagon", label: "Lagon", hex: "#1a96a3" },
  { key: "mandarine", label: "Mandarine", hex: "#ee8121" },
  { key: "framboise", label: "Framboise", hex: "#d6457e" },
] as const;

export function crayonFor(color: string | null | undefined, index: number): string {
  return CRAYONS.find((c) => c.key === color)?.hex ?? CRAYONS[index % CRAYONS.length].hex;
}
