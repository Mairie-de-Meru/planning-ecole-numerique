import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Period } from "@/db/schema";
import { todayParis } from "../dates";
import { getSettings, updateSettings } from "../settings";
import { derivePeriods, type DerivedPeriod } from "./derive";
import { fetchCalendars } from "./scraper";

export type ProposalChange = DerivedPeriod & {
  type: "add" | "update";
  previous?: { startDate: string; endDate: string; label: string };
};

export function diffPeriods(existing: Period[], derived: DerivedPeriod[], today = todayParis()): ProposalChange[] {
  const changes: ProposalChange[] = [];
  for (const d of derived) {
    if (d.endDate < today) continue;
    const cur = existing.find((p) => p.schoolYear === d.schoolYear && p.position === d.position && p.zone === d.zone);
    if (!cur) changes.push({ ...d, type: "add" });
    else if (cur.locked) continue;
    else if (cur.startDate !== d.startDate || cur.endDate !== d.endDate || cur.label !== d.label)
      changes.push({ ...d, type: "update", previous: { startDate: cur.startDate, endDate: cur.endDate, label: cur.label } });
  }
  return changes;
}

export async function runSync(): Promise<{ ok: boolean; message: string; changes: number }> {
  const settings = await getSettings();
  try {
    const cals = await fetchCalendars(settings.sourceUrl, settings.zone);
    const derived = cals.flatMap((c) => derivePeriods(c, { splitJune: settings.splitJune }));
    if (!derived.length) throw new Error("aucune date de vacances reconnue sur la page (structure modifiée ?)");
    const existing = await db.select().from(schema.periods).where(eq(schema.periods.zone, settings.zone));
    const changes = diffPeriods(existing, derived);
    // Une seule proposition en attente à la fois : la plus récente remplace les autres.
    await db
      .update(schema.periodProposals)
      .set({ status: "superseded", decidedAt: new Date() })
      .where(eq(schema.periodProposals.status, "pending"));
    if (changes.length) {
      await db.insert(schema.periodProposals).values({ zone: settings.zone, payload: changes });
    }
    const message = changes.length
      ? `${changes.length} modification(s) proposée(s) — à valider`
      : `À jour (${derived.length} périodes lues pour la zone ${settings.zone})`;
    await updateSettings({ lastSyncAt: new Date(), lastSyncStatus: message });
    return { ok: true, message, changes: changes.length };
  } catch (e) {
    const message = `Échec : ${e instanceof Error ? e.message : String(e)}`;
    await updateSettings({ lastSyncAt: new Date(), lastSyncStatus: message });
    return { ok: false, message, changes: 0 };
  }
}

export async function applyProposal(id: string) {
  const [p] = await db.select().from(schema.periodProposals).where(eq(schema.periodProposals.id, id));
  if (!p || p.status !== "pending") throw new Error("Proposition introuvable ou déjà traitée.");
  const changes = p.payload as ProposalChange[];
  await db.transaction(async (tx) => {
    for (const c of changes) {
      const [cur] = await tx
        .select()
        .from(schema.periods)
        .where(and(eq(schema.periods.schoolYear, c.schoolYear), eq(schema.periods.position, c.position), eq(schema.periods.zone, c.zone)));
      if (cur?.locked) continue;
      if (cur) {
        await tx
          .update(schema.periods)
          .set({ startDate: c.startDate, endDate: c.endDate, label: c.label, source: "auto", updatedAt: new Date() })
          .where(eq(schema.periods.id, cur.id));
      } else {
        await tx.insert(schema.periods).values({
          schoolYear: c.schoolYear,
          position: c.position,
          label: c.label,
          startDate: c.startDate,
          endDate: c.endDate,
          zone: c.zone,
          source: "auto",
        });
      }
    }
    await tx.update(schema.periodProposals).set({ status: "applied", decidedAt: new Date() }).where(eq(schema.periodProposals.id, id));
  });
}

export async function rejectProposal(id: string) {
  await db
    .update(schema.periodProposals)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(and(eq(schema.periodProposals.id, id), eq(schema.periodProposals.status, "pending")));
}
