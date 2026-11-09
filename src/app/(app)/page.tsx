import { redirect } from "next/navigation";
import { CalendarX2, PackageOpen } from "lucide-react";
import { requireUser, schoolProfileComplete } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { planningData } from "@/lib/planning-data";
import { Planning } from "@/components/planning";
import { YearTabs } from "@/components/year-tabs";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const user = await requireUser();
  if (!schoolProfileComplete(user.school)) redirect(user.admin && !user.school ? "/admin" : "/mon-ecole?premiere=1");
  const settings = await getSettings();
  const { annee } = await searchParams;
  const data = await planningData({ zone: settings.zone, year: annee, mode: "school", schoolId: user.school!.id });

  return (
    <>
      <PageHeader
        title="Planning des valises"
        description="Choisissez une valise et une période libre. Premier réservé, premier servi : la réservation est validée par e-mail."
        actions={data.year && <YearTabs years={data.years} current={data.year} base="/" />}
      />
      {!data.year ? (
        <EmptyState icon={<CalendarX2 className="size-8" />} title="Aucune période ouverte">
          Les périodes de réservation n&apos;ont pas encore été publiées. Revenez bientôt.
        </EmptyState>
      ) : !data.items.length ? (
        <EmptyState icon={<PackageOpen className="size-8" />} title="Aucune valise disponible">
          Le catalogue est vide pour le moment.
        </EmptyState>
      ) : (
        <Planning
          mode="school"
          periods={data.periods}
          items={data.items}
          slots={data.slots}
          school={{ name: user.school!.name, address: user.school!.address }}
        />
      )}
    </>
  );
}
