import { notFound } from "next/navigation";
import { CircleCheck, Clock, Ban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { amendmentsOf, conventionHtml, conventionNumber, formatStamp, getConvention, METHOD_LABEL } from "@/lib/conventions";
import { getSettings } from "@/lib/settings";
import { ConventionText } from "@/components/signature-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ConventionToolbar, SignConvention } from "./convention-actions";
import { HandoverForm } from "./handover-form";
import { SheetButtons } from "@/components/sheet-buttons";
import { Disclosure } from "@/components/disclosure";
import { frLong, todayParis } from "@/lib/dates";
import type { LoanLine } from "@/lib/inventory";

export const metadata = { title: "Convention de prêt" };

function Accepted({ at, name, method }: { at: Date | null; name: string | null; method: string | null }) {
  return at ? (
    <span className="mt-1 block text-xs font-semibold text-ok">
      ✓ Confirmée par {name} le {formatStamp(at)}, {method}
    </span>
  ) : (
    <span className="mt-1 block text-xs font-semibold text-warn">En attente de confirmation par l&apos;école</span>
  );
}

export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const full = await getConvention(id);
  if (!full || !(user.admin || user.school?.id === full.school.id)) notFound();
  const settings = await getSettings();
  const c = full.convention;
  const owner = user.school?.id === full.school.id;
  const amendments = amendmentsOf(c);
  const sheet = (c.loanSheet as LoanLine[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={`Convention n° ${conventionNumber(c)}`}
        title={`${full.item.name} · Période ${full.period.position}`}
        description={`${full.school.name} — année scolaire ${full.period.schoolYear}`}
        actions={<ConventionToolbar id={id} canEmail={!!full.school.email && (owner || user.admin)} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {c.status === "signed" && (
          <Badge tone="ok">
            <CircleCheck className="size-3.5" /> Signée le {formatStamp(c.signedAt!)} par {c.signerName}
          </Badge>
        )}
        {c.status === "to_sign" && (
          <Badge tone="warn">
            <Clock className="size-3.5" /> À signer
          </Badge>
        )}
        {c.status === "cancelled" && (
          <Badge tone="danger">
            <Ban className="size-3.5" /> Réservation annulée
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-3 text-xs font-bold uppercase tracking-wider text-accent sm:px-10">{settings.lenderName}</div>
        <div className="px-6 py-8 sm:px-10">
          <ConventionText html={conventionHtml(c.body)} />

          {amendments.length > 0 && (
            <div className="mt-6 rounded-xl bg-surface-2 p-4 text-sm">
              <p className="mb-1 font-extrabold">Modifications</p>
              <ul className="space-y-1 text-ink-2">
                {amendments.map((a, i) => (
                  <li key={i}>
                    <span className="text-muted">{a.at} —</span> {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line-strong p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Pour l&apos;école</p>
              {c.status === "signed" || (c.status === "cancelled" && c.signedAt) ? (
                <div className="mt-2 text-sm">
                  <p className="font-extrabold">{c.signerName}</p>
                  <p className="text-ink-2">{c.signerTitle}</p>
                  <p className="mt-1 text-xs text-muted">
                    Acceptée en ligne le {formatStamp(c.signedAt!)}
                    <br />
                    {METHOD_LABEL[c.signatureMethod ?? "checkbox"]} · {c.signerEmail}
                  </p>
                  {c.signatureImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.signatureImage} alt="Signature" className="mt-2 h-16 w-auto rounded bg-white" />
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">En attente de signature</p>
              )}
            </div>
            <div className="rounded-xl border border-line-strong p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Pour le prêteur</p>
              <p className="mt-2 text-sm font-extrabold">{settings.lenderSignatoryName}</p>
              <p className="text-sm text-ink-2">{settings.lenderSignatoryTitle}</p>
              <p className="mt-1 text-xs text-muted">{settings.lenderName} · convention établie et horodatée par la plateforme.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <h2 className="text-lg font-extrabold">Fiche de prêt</h2>
            <p className="text-sm text-muted">
              Du {frLong(full.period.startDate)} au {frLong(full.period.endDate)} · stockage : {c.storageLocation ?? "à préciser à la signature"}
            </p>
          </div>
          {user.admin && c.status !== "cancelled" && <SheetButtons conventionId={id} canEmail={!!full.school.email} size="sm" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-2.5 font-bold sm:pl-10">Matériel</th>
                <th className="px-3 py-2.5 font-bold">N° de série</th>
                <th className="px-3 py-2.5 text-right font-bold">Qté</th>
                <th className="px-3 py-2.5 font-bold">Remise</th>
                <th className="px-3 py-2.5 font-bold sm:pr-10">Reprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sheet.map((l, i) => (
                <tr key={i}>
                  <td className="px-6 py-2 font-semibold sm:pl-10">{l.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-2">{l.serial || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 text-ink-2">{l.stateOut ?? <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2 text-ink-2 sm:pr-10">{l.stateIn ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-line px-6 py-5 text-sm sm:grid-cols-2 sm:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Remise</p>
            {c.deliveredAt ? (
              <p className="mt-1">
                Le {frLong(c.deliveredAt)} par {c.deliveredBy}
                {c.deliveryNote && <span className="block text-muted">{c.deliveryNote}</span>}
                <Accepted at={c.deliveryAcceptedAt} name={c.deliveryAcceptedName} method={c.deliveryAcceptedMethod} />
              </p>
            ) : (
              <p className="mt-1 text-muted">À compléter par le service informatique à la livraison.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Reprise</p>
            {c.returnedAt ? (
              <p className="mt-1">
                Le {frLong(c.returnedAt)} par {c.returnedBy}
                {c.returnNote && <span className="block text-muted">{c.returnNote}</span>}
                <Accepted at={c.returnAcceptedAt} name={c.returnAcceptedName} method={c.returnAcceptedMethod} />
              </p>
            ) : (
              <p className="mt-1 text-muted">À compléter par le service informatique à la reprise.</p>
            )}
          </div>
        </div>
      </Card>

      {user.admin && c.status !== "cancelled" && (
        <div className="mt-6 space-y-3">
          <Disclosure summary={<p className="font-bold">{c.deliveredAt ? "Modifier la remise" : "Enregistrer la remise du matériel"}</p>} defaultOpen={!c.deliveredAt}>
            <HandoverForm
              kind="delivery"
              id={id}
              sheet={sheet}
              canEmail={!!full.school.email}
              defaults={{
                at: c.deliveredAt ?? (todayParis() < full.period.startDate ? full.period.startDate : todayParis()),
                by: c.deliveredBy ?? `${settings.lenderSignatoryName}, ${settings.lenderSignatoryTitle.toLowerCase()}`,
                note: c.deliveryNote ?? "Matériel livré chargé et nettoyé.",
              }}
            />
          </Disclosure>
          {c.deliveredAt && (
            <Disclosure summary={<p className="font-bold">{c.returnedAt ? "Modifier la reprise" : "Enregistrer la reprise du matériel"}</p>} defaultOpen={!c.returnedAt}>
              <HandoverForm
                kind="return"
                id={id}
                sheet={sheet}
                canEmail={!!full.school.email}
                defaults={{
                  at: c.returnedAt ?? [todayParis(), full.period.endDate, c.deliveredAt].sort()[1],
                  by: c.returnedBy ?? `${settings.lenderSignatoryName}, ${settings.lenderSignatoryTitle.toLowerCase()}`,
                  note: c.returnNote ?? "",
                }}
              />
            </Disclosure>
          )}
        </div>
      )}

      {c.status === "to_sign" && owner && (
        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-extrabold">Signer la convention</h2>
          <p className="mb-5 text-sm text-muted">Un simple « J&apos;accepte » suffit ; la signature manuscrite est facultative.</p>
          <SignConvention id={id} defaults={{ signerName: full.school.directorName, signerTitle: full.school.directorTitle, storageLocation: "Bureau de direction" }} />
        </Card>
      )}
    </div>
  );
}
