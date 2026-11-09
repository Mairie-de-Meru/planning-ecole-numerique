/**
 * Inventaire d'une mallette, une ligne par élément :
 *   Désignation | N° de série | Qté | État
 * (les colonnes après la désignation sont facultatives)
 */
export type InventoryLine = { label: string; serial: string; qty: number; state: string };
export type LoanLine = InventoryLine & { stateOut: string | null; stateIn: string | null };

export const STATES = ["Très bon état", "Bon état", "État correct", "Usé", "Endommagé", "Hors service", "Manquant"] as const;

export function parseInventory(text: string): InventoryLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .map((l) => {
      const [label = "", serial = "", qty = "", state = ""] = l.split("|").map((x) => x.trim());
      const n = parseInt(qty, 10);
      return { label, serial: /^n\/?a$/i.test(serial) ? "" : serial, qty: Number.isFinite(n) && n > 0 ? n : 1, state };
    })
    .filter((x) => x.label);
}

export function formatInventory(lines: InventoryLine[]): string {
  return lines.map((l) => [l.label, l.serial || "N/A", String(l.qty), l.state].join(" | ").replace(/\s\|\s$/, "")).join("\n");
}

export function toLoanSheet(text: string): LoanLine[] {
  return parseInventory(text).map((l) => ({ ...l, stateOut: null, stateIn: null }));
}

/** Résumé court : « 9 × iPad Air 2, 1 × Valise de transport… » */
export function inventorySummary(lines: InventoryLine[]): string {
  return lines.map((l) => `${l.qty > 1 ? `${l.qty} × ` : ""}${l.label}`).join(", ");
}
