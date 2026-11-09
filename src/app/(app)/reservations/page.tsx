import { redirect } from "next/navigation";
import { CalendarCheck, Clock, Check } from "lucide-react";
import { requireUser, schoolProfileComplete } from "@/lib/auth";
import { schoolReservations } from "@/lib/reservations";
import { frLong, periodState } from "@/lib/dates";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Mes réservations" };

export default async function MyReservations() {
  const user = await requireUser();
  if (!schoolProfileComplete(user.school)) redirect("/mon-ecole?premiere=1");
  const rows = (await schoolReservations(user.school!.id)).filter(
    (r) => r.r.status === "confirmed" || (r.r.expiresAt && r.r.expiresAt > new Date()),
  );
  const groups = {
    current: rows.filter((r) => periodState(r.period) === "current"),
    upcoming: rows.filter((r) => periodState(r.period) === "upcoming"),
    past: rows.filter((r) => periodState(r.period) === "past").reverse(),
  };

  return (
    <>
      <PageHeader
        title="Mes réservations"
        description="Pour décaler ou annuler une réservation à venir, cliquez dessus dans le planning."
        actions={<LinkButton href="/">Ouvrir le planning</LinkButton>}
      />
      {!rows.length ? (
        <EmptyState icon={<CalendarCheck className="size-8" />} title="Aucune réservation pour le moment">
          Rendez-vous sur le planning pour réserver une valise.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {(
            [
              ["current", "En cours"],
              ["upcoming", "À venir"],
              ["past", "Passées"],
            ] as const
          ).map(([k, title]) =>
            groups[k].length ? (
              <section key={k}>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groups[k].map(({ r, item, period }) => (
                    <Card key={r.id} className={k === "past" ? "p-5 opacity-60" : "p-5"}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium">{item.name}</div>
                        {r.status === "pending" ? (
                          <Badge tone="warn"><Clock className="size-3" /> À confirmer</Badge>
                        ) : (
                          <Badge tone={k === "past" ? "neutral" : "ok"}><Check className="size-3" /> Confirmée</Badge>
                        )}
                      </div>
                      <div className="mt-3 text-sm font-medium text-ink-2">
                        {period.label} <span className="font-normal text-muted">· {period.schoolYear}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        Du {frLong(period.startDate)}
                        <br />
                        au {frLong(period.endDate)}
                      </div>
                      {k === "upcoming" && (
                        <LinkButton href={`/?annee=${period.schoolYear}`} variant="secondary" size="sm" className="mt-4">
                          Décaler ou annuler
                        </LinkButton>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}
