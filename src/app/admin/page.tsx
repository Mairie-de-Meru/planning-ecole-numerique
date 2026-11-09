import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CalendarX2, PackageOpen, RefreshCw } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { planningData } from "@/lib/planning-data";
import { Planning } from "@/components/planning";
import { YearTabs } from "@/components/year-tabs";
import { Alert, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Administration" };

export default async function AdminPlanning({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const settings = await getSettings();
  const { annee } = await searchParams;
  const data = await planningData({ zone: settings.zone, year: annee, mode: "admin" });
  const schools = await db.select({ id: schema.schools.id, name: schema.schools.name, email: schema.schools.email }).from(schema.schools).orderBy(asc(schema.schools.name));
  const [proposal] = await db.select({ id: schema.periodProposals.id }).from(schema.periodProposals).where(eq(schema.periodProposals.status, "pending")).limit(1);

  return (
    <>
      <PageHeader
        eyebrow={data.year ? `Année scolaire ${data.year} · zone ${settings.zone}` : undefined}
        title="Planning global"
        description="Cliquez sur une case pour attribuer, décaler ou annuler une réservation."
        actions={data.year && <YearTabs years={data.years} current={data.year} base="/admin" />}
      />
      {proposal && (
        <Alert tone="accent" className="mb-6 flex items-center gap-2">
          <RefreshCw className="size-4 shrink-0" />
          <span>
            De nouvelles dates de vacances ont été détectées.{" "}
            <Link href="/admin/periodes" className="font-semibold underline">
              Vérifier et valider
            </Link>
          </span>
        </Alert>
      )}
      {!data.year ? (
        <EmptyState icon={<CalendarX2 className="size-8" />} title="Aucune période">
          Ajoutez des périodes ou lancez la mise à jour automatique depuis l&apos;onglet <Link className="underline" href="/admin/periodes">Périodes</Link>.
        </EmptyState>
      ) : !data.items.length ? (
        <EmptyState icon={<PackageOpen className="size-8" />} title="Aucune valise">
          Ajoutez votre première valise depuis l&apos;onglet <Link className="underline" href="/admin/valises">Valises</Link>.
        </EmptyState>
      ) : (
        <Planning mode="admin" periods={data.periods} items={data.items} slots={data.slots}
          today={data.today} schools={schools} />
      )}
    </>
  );
}
