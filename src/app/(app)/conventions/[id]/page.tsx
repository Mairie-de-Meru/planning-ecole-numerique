import { notFound } from "next/navigation";
import { CircleCheck, Clock, Ban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { amendmentsOf, conventionHtml, conventionNumber, formatStamp, getConvention, METHOD_LABEL } from "@/lib/conventions";
import { getSettings } from "@/lib/settings";
import { ConventionText } from "@/components/signature-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ConventionToolbar, SignConvention } from "./convention-actions";

export const metadata = { title: "Convention de prêt" };

export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const full = await getConvention(id);
  if (!full || !(user.admin || user.school?.id === full.school.id)) notFound();
  const settings = await getSettings();
  const c = full.convention;
  const owner = user.school?.id === full.school.id;
  const amendments = amendmentsOf(c);

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
              <p className="mt-2 text-sm font-extrabold">{settings.lenderName}</p>
              <p className="text-xs text-muted">Convention établie et horodatée par la plateforme.</p>
            </div>
          </div>
        </div>
      </Card>

      {c.status === "to_sign" && owner && (
        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-extrabold">Signer la convention</h2>
          <p className="mb-5 text-sm text-muted">Un simple « J&apos;accepte » suffit ; la signature manuscrite est facultative.</p>
          <SignConvention id={id} defaults={{ signerName: full.school.directorName, signerTitle: full.school.directorTitle }} />
        </Card>
      )}
    </div>
  );
}
