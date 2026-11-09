import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowRight, Lock, LockOpen, Plus } from "lucide-react";
import { db, schema } from "@/db";
import type { Period } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { frLong, frRange, periodState } from "@/lib/dates";
import type { ProposalChange } from "@/lib/periods/sync";
import { ActionForm } from "@/components/action-form";
import { Disclosure } from "@/components/disclosure";
import { SubmitButton } from "@/components/client";
import { Badge, Card, EmptyState, Field, Input, PageHeader, cx } from "@/components/ui";
import { applyProposalAction, rejectProposalAction, savePeriodAction, toggleLockAction } from "../actions";
import { SyncButton } from "./sync-button";
import { DeletePeriod } from "./delete-period";

export const metadata = { title: "Périodes" };

function PeriodFields({ p }: { p?: Period }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Libellé"><Input name="label" required defaultValue={p?.label} placeholder="Toussaint → Noël" /></Field>
        <Field label="Année scolaire"><Input name="schoolYear" required defaultValue={p?.schoolYear} placeholder="2026-2027" pattern="\d{4}-\d{4}" /></Field>
        <Field label="Position (1 à 5)"><Input name="position" type="number" min={1} max={9} required defaultValue={p?.position ?? 1} /></Field>
        <Field label="Premier jour"><Input name="startDate" type="date" required defaultValue={p?.startDate} /></Field>
        <Field label="Dernier jour"><Input name="endDate" type="date" required defaultValue={p?.endDate} /></Field>
        <label className="flex items-center gap-2.5 self-end pb-3 text-sm">
          <input type="checkbox" name="locked" defaultChecked={p?.locked ?? true} className="size-4 accent-[var(--accent)]" />
          Verrouiller (la mise à jour auto ne la modifie pas)
        </label>
      </div>
    </>
  );
}

export default async function PeriodsPage() {
  const settings = await getSettings();
  const periods = await db.select().from(schema.periods).where(eq(schema.periods.zone, settings.zone)).orderBy(desc(schema.periods.schoolYear), asc(schema.periods.position));
  const [proposal] = await db
    .select()
    .from(schema.periodProposals)
    .where(and(eq(schema.periodProposals.status, "pending"), eq(schema.periodProposals.zone, settings.zone)))
    .orderBy(desc(schema.periodProposals.createdAt))
    .limit(1);
  const years = [...new Set(periods.map((p) => p.schoolYear))];

  return (
    <>
      <PageHeader
        title="Périodes de réservation"
        description={
          <>
            Les périodes vont d&apos;une vacance à la suivante (zone {settings.zone}). Les dates sont lues automatiquement sur service-public.gouv.fr
            {settings.syncEnabled ? " chaque semaine" : " (lecture automatique désactivée)"} ; rien n&apos;est modifié sans votre validation.
          </>
        }
        actions={<SyncButton />}
      />

      {settings.lastSyncAt && (
        <p className={cx("-mt-4 mb-6 text-sm", settings.lastSyncStatus?.startsWith("Échec") ? "text-danger" : "text-muted")}>
          Dernière lecture : {settings.lastSyncAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })} — {settings.lastSyncStatus}
        </p>
      )}

      {proposal && (
        <Card className="mb-8 border-accent-line p-6">
          <h2 className="font-semibold">Nouvelles dates détectées</h2>
          <p className="mt-1 text-sm text-muted">Vérifiez les changements avant de les appliquer. Les périodes verrouillées ne sont pas concernées.</p>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
            {(proposal.payload as ProposalChange[]).map((c) => (
              <li key={`${c.schoolYear}-${c.position}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <Badge tone={c.type === "add" ? "ok" : "warn"}>{c.type === "add" ? "Nouvelle" : "Modifiée"}</Badge>
                <span className="font-medium">{c.label}</span>
                <span className="text-muted">{c.schoolYear}</span>
                <span className="ml-auto inline-flex items-center gap-2 text-ink-2">
                  {c.previous && (
                    <>
                      <span className="text-muted line-through">{frRange(c.previous.startDate, c.previous.endDate)}</span>
                      <ArrowRight className="size-3.5 text-muted" />
                    </>
                  )}
                  {frRange(c.startDate, c.endDate)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <form action={applyProposalAction}>
              <input type="hidden" name="id" value={proposal.id} />
              <SubmitButton pendingLabel="Application…">Appliquer ces dates</SubmitButton>
            </form>
            <form action={rejectProposalAction}>
              <input type="hidden" name="id" value={proposal.id} />
              <SubmitButton variant="ghost">Ignorer</SubmitButton>
            </form>
          </div>
        </Card>
      )}

      <div className="mb-8">
        <Disclosure summary={<span className="inline-flex items-center gap-2 font-medium text-accent"><Plus className="size-4" /> Ajouter une période manuellement</span>}>
          <ActionForm action={savePeriodAction} submitLabel="Ajouter" resetOnSuccess>
            <PeriodFields />
          </ActionForm>
        </Disclosure>
      </div>

      {!periods.length ? (
        <EmptyState title="Aucune période">Lancez la lecture des dates ou ajoutez une période manuellement.</EmptyState>
      ) : (
        <div className="space-y-8">
          {years.map((y) => (
            <section key={y}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{y}</h2>
              <div className="space-y-2">
                {periods
                  .filter((p) => p.schoolYear === y)
                  .map((p) => (
                    <Disclosure
                      key={p.id}
                      className={periodState(p) === "past" ? "opacity-60" : undefined}
                      summary={
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-sm text-muted">du {frLong(p.startDate)} au {frLong(p.endDate)}</span>
                          <span className="ml-auto flex gap-1.5">
                            {periodState(p) === "current" && <Badge tone="accent">En cours</Badge>}
                            <Badge>{p.source === "auto" ? "Auto" : "Manuelle"}</Badge>
                            {p.locked && <Badge tone="warn"><Lock className="size-3" /> Verrouillée</Badge>}
                          </span>
                        </div>
                      }
                    >
                      <ActionForm action={savePeriodAction} submitLabel="Enregistrer">
                        <PeriodFields p={p} />
                      </ActionForm>
                      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-t border-line pt-4">
                        <form action={toggleLockAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:underline">
                            {p.locked ? <><LockOpen className="size-3.5" /> Déverrouiller</> : <><Lock className="size-3.5" /> Verrouiller</>}
                          </button>
                        </form>
                        <DeletePeriod id={p.id} />
                      </div>
                    </Disclosure>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
