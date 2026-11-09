import { redirect } from "next/navigation";
import { CalendarCheck, Clock, Check } from "lucide-react";
import { requireUser, schoolProfileComplete } from "@/lib/auth";
import { schoolReservations } from "@/lib/reservations";
import { frLong, periodState } from "@/lib/dates";
import { Badge, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { itemColors } from "@/lib/planning-data";

export const metadata = { title: "Mes réservations" };

export default async function MyReservations() {
  const user = await requireUser();
  if (!schoolProfileComplete(user.school)) redirect("/mon-ecole?premiere=1");
  const rows = (await schoolReservations(user.school!.id)).filter(
    (r) => r.r.status === "confirmed" || (r.r.expiresAt && r.r.expiresAt > new Date()),
  );
  const colors = await itemColors();
  const groups = {
    current: rows.filter((r) => periodState(r.period) === "current"),
    upcoming: rows.filter((r) => periodState(r.period) === "upcoming"),
    past: rows.filter((r) => periodState(r.period) === "past").reverse(),
  };

  return (
    <>
      <PageHeader
        eyebrow="Le cartable de l'école"
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
                <h2 className="mb-3 font-hand text-3xl leading-none text-accent">{title}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groups[k].map(({ r, item, period }) => (
                    <article
                      key={r.id}
                      className={cx("crayon overflow-hidden rounded-2xl border-2 border-line bg-surface shadow-card", k === "past" && "opacity-60")}
                      style={{ ["--c" as string]: colors.get(item.id) }}
                    >
                      <div className="h-2 bg-[var(--c)]" />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-lg font-extrabold leading-tight">{item.name}</div>
                          {r.status === "pending" ? (
                            <Badge tone="warn"><Clock className="size-3" /> À confirmer</Badge>
                          ) : (
                            <Badge tone={k === "past" ? "neutral" : "ok"}><Check className="size-3" /> Confirmée</Badge>
                          )}
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="rounded-lg bg-[var(--c-soft)] px-2 py-0.5 text-sm font-extrabold text-[var(--c-ink)]">Période {period.position}</span>
                          <span className="text-sm font-semibold text-muted">{period.label}</span>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold text-ink-2">
                          Du {frLong(period.startDate)}
                          <br />
                          au {frLong(period.endDate)}
                        </div>
                        {k === "upcoming" && (
                          <LinkButton href={`/?annee=${period.schoolYear}`} variant="secondary" size="sm" className="mt-5">
                            Décaler ou annuler
                          </LinkButton>
                        )}
                      </div>
                    </article>
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
