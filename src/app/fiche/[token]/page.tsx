import { notFound } from "next/navigation";
import { CircleCheck, Clock, Download, Tablet, Truck, Undo2 } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { conventionNumber, formatStamp, getBySheetToken, pendingStep } from "@/lib/conventions";
import { frLong } from "@/lib/dates";
import type { LoanLine } from "@/lib/inventory";
import { getSettings } from "@/lib/settings";
import { crayonFor } from "@/lib/colors";
import { Brand } from "@/components/brand";
import { Thumb } from "@/components/thumb";
import { Alert, Badge, Card, buttonClass, cx } from "@/components/ui";
import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de prêt", robots: { index: false } };

function StateChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted">—</span>;
  const bad = /endommag|hors service|manquant/i.test(value);
  const worn = /usé/i.test(value);
  return <Badge tone={bad ? "danger" : worn ? "warn" : "ok"}>{value}</Badge>;
}

export default async function SheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const full = await getBySheetToken(token);
  if (!full) notFound();
  const [settings, user] = await Promise.all([getSettings(), currentUser()]);
  const c = full.convention;
  const sheet = (c.loanSheet as LoanLine[]) ?? [];
  const step = c.status === "cancelled" ? null : pendingStep(c);
  const onSite = !!user?.admin;

  const steps = [
    {
      key: "delivery" as const,
      icon: Truck,
      title: "Remise",
      at: c.deliveredAt,
      by: c.deliveredBy,
      note: c.deliveryNote,
      acceptedAt: c.deliveryAcceptedAt,
      acceptedName: c.deliveryAcceptedName,
      acceptedMethod: c.deliveryAcceptedMethod,
      signature: c.deliveryAcceptedSignature,
    },
    {
      key: "return" as const,
      icon: Undo2,
      title: "Reprise",
      at: c.returnedAt,
      by: c.returnedBy,
      note: c.returnNote,
      acceptedAt: c.returnAcceptedAt,
      acceptedName: c.returnAcceptedName,
      acceptedMethod: c.returnAcceptedMethod,
      signature: c.returnAcceptedSignature,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Brand name={settings.appName} />
        <span className="text-xs font-bold text-muted">N° {conventionNumber(c)}</span>
      </div>

      {onSite && step && (
        <Alert tone="accent" className="mb-5 flex items-start gap-3">
          <Tablet className="mt-0.5 size-5 shrink-0 text-accent" />
          <span>
            <strong>Confirmation sur place.</strong> Tendez l&apos;écran à la directrice ou au directeur : la confirmation sera enregistrée « sur place, en
            présence du service informatique ».
          </span>
        </Alert>
      )}

      <header className="mb-6 flex items-center gap-4">
        <Thumb src={full.item.photoUrl} color={crayonFor(full.item.color, 0)} alt="" className="size-16 sm:size-20" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Fiche de prêt</p>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{full.item.name}</h1>
          <p className="text-[15px] font-semibold text-muted">{full.school.name}</p>
        </div>
      </header>

      <Card className="mb-6 grid grid-cols-2 gap-px overflow-hidden bg-line p-0 text-sm sm:grid-cols-4">
        {(
          [
            ["Période", `Période ${full.period.position} · ${full.period.schoolYear}`],
            ["Du", frLong(full.period.startDate)],
            ["Au", frLong(full.period.endDate)],
            ["Stockage", c.storageLocation ?? "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{k}</p>
            <p className="mt-0.5 font-bold first-letter:uppercase">{v}</p>
          </div>
        ))}
      </Card>

      {/* Remise / reprise */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <Card key={s.key} className={cx("p-4", step === s.key && "border-accent ring-4 ring-accent/10")}>
            <div className="flex items-center gap-2">
              <s.icon className="size-4 text-muted" />
              <p className="font-extrabold">{s.title}</p>
              <span className="ml-auto">
                {!s.at ? (
                  <Badge>À venir</Badge>
                ) : s.acceptedAt ? (
                  <Badge tone="ok">
                    <CircleCheck className="size-3" /> Confirmée
                  </Badge>
                ) : (
                  <Badge tone="warn">
                    <Clock className="size-3" /> À confirmer
                  </Badge>
                )}
              </span>
            </div>
            {s.at ? (
              <div className="mt-2 text-sm">
                <p>
                  Le {frLong(s.at)} par {s.by}
                </p>
                {s.note && <p className="text-muted">« {s.note} »</p>}
                {s.acceptedAt && (
                  <p className="mt-2 text-xs text-muted">
                    Confirmée par <span className="font-bold text-ink-2">{s.acceptedName}</span> le {formatStamp(s.acceptedAt)}, {s.acceptedMethod}.
                  </p>
                )}
                {s.signature && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.signature} alt="Signature" className="mt-2 h-12 w-auto rounded bg-white" />
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Effectuée par le {settings.itService}.</p>
            )}
          </Card>
        ))}
      </div>

      {/* Matériel */}
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted">Matériel ({sheet.reduce((n, l) => n + l.qty, 0)} éléments)</h2>
      <ul className="mb-8 space-y-2 sm:hidden">
        {sheet.map((l, i) => (
          <li key={i} className="rounded-xl border border-line-strong bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold leading-snug">{l.label}</p>
              <span className="shrink-0 rounded-md bg-surface-2 px-1.5 text-sm font-bold tabular-nums">×{l.qty}</span>
            </div>
            {l.serial && <p className="font-mono text-xs text-muted">{l.serial}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                Remise <StateChip value={l.stateOut} />
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                Reprise <StateChip value={l.stateIn} />
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Card className="mb-8 hidden overflow-hidden sm:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-bold">Matériel</th>
              <th className="px-3 py-2.5 font-bold">N° de série</th>
              <th className="px-3 py-2.5 text-right font-bold">Qté</th>
              <th className="px-3 py-2.5 font-bold">Remise</th>
              <th className="px-4 py-2.5 font-bold">Reprise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sheet.map((l, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 font-semibold">{l.label}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-2">{l.serial || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.qty}</td>
                <td className="px-3 py-2.5">
                  <StateChip value={l.stateOut} />
                </td>
                <td className="px-4 py-2.5">
                  <StateChip value={l.stateIn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {c.status === "cancelled" ? (
        <Alert tone="danger">Cette réservation a été annulée.</Alert>
      ) : step ? (
        <Card className="p-5 sm:p-7">
          <h2 className="text-xl font-extrabold">Confirmer la {step === "delivery" ? "remise" : "reprise"}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Vérifiez la liste ci-dessus avec le {settings.itService}, puis confirmez.</p>
          <AcceptForm token={token} step={step} defaultName={full.school.directorName} />
        </Card>
      ) : (
        <Alert tone="ok" className="flex items-center gap-2">
          <CircleCheck className="size-4" />
          {c.returnAcceptedAt ? "Prêt terminé : remise et reprise confirmées." : c.deliveryAcceptedAt ? "Remise confirmée. La reprise sera à confirmer en fin de période." : "Rien à confirmer pour le moment."}
        </Alert>
      )}

      <div className="mt-8 flex justify-center">
        <a href={`/fiche/${token}/pdf`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
          <Download className="size-4" /> Convention et fiche de prêt (PDF)
        </a>
      </div>
    </main>
  );
}
