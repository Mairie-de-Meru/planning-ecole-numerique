import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { peekByToken } from "@/lib/reservations";
import { frLong } from "@/lib/dates";
import { Brand } from "@/components/brand";
import { Card, buttonClass } from "@/components/ui";
import { ConfirmForm } from "./confirm-form";

export const metadata = { title: "Confirmer la réservation" };
export const dynamic = "force-dynamic";

/** Page de confirmation : un bouton à cliquer (les antivirus de messagerie qui pré-visitent le lien ne confirment rien). */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSettings();
  const full = await peekByToken(token);
  const confirmed = full?.r.status === "confirmed";
  const expired = !full || (!confirmed && (full.r.status !== "pending" || (full.r.expiresAt && full.r.expiresAt < new Date())));

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand name={settings.appName} />
        </div>
        <Card className="p-7">
          {confirmed ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
                <CircleCheck className="size-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Réservation confirmée</h1>
              <p className="mt-2 text-[15px] text-muted">
                « {full!.item.name} » est réservée pour la période {full!.period.label}, du {frLong(full!.period.startDate)} au{" "}
                {frLong(full!.period.endDate)}. Un e-mail récapitulatif vous a été envoyé.
              </p>
              <Link href="/reservations" className={buttonClass("primary", "md", "mt-6 w-full")}>
                Voir mes réservations
              </Link>
            </div>
          ) : expired ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight">Lien plus valable</h1>
              <p className="mt-2 text-[15px] text-muted">
                Cette réservation a déjà été confirmée, annulée, ou le délai de confirmation est dépassé.
              </p>
              <Link href="/" className={buttonClass("primary", "md", "mt-6 w-full")}>
                Ouvrir le planning
              </Link>
            </div>
          ) : (
            <ConfirmForm token={token}>
              <h1 className="text-xl font-semibold tracking-tight">Confirmer la réservation</h1>
              <dl className="mt-5 divide-y divide-line rounded-xl bg-surface-2 text-sm">
                {(
                  [
                    ["Valise", full!.item.name],
                    ["Période", `${full!.period.label} (${full!.period.schoolYear})`],
                    ["Du", frLong(full!.period.startDate)],
                    ["Au", frLong(full!.period.endDate)],
                    ["École", full!.school.name],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-4 px-4 py-2.5">
                    <dt className="w-20 shrink-0 text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </ConfirmForm>
          )}
        </Card>
      </div>
    </main>
  );
}
