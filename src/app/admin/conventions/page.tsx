import Link from "next/link";
import { FileText, RotateCcw } from "lucide-react";
import { activeTemplate, conventionNumber, formatStamp, listConventions } from "@/lib/conventions";
import { PLACEHOLDERS, toHtml } from "@/lib/convention-doc";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/action-form";
import { Disclosure } from "@/components/disclosure";
import { ConfirmSubmit } from "@/components/client";
import { ConventionText } from "@/components/signature-form";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { resetTemplateAction, saveLenderAction, saveTemplateAction } from "../actions";

export const metadata = { title: "Conventions" };

const STATUS = {
  signed: { tone: "ok", label: "Signée" },
  to_sign: { tone: "warn", label: "À signer" },
  cancelled: { tone: "neutral", label: "Annulée" },
} as const;

export default async function ConventionsAdmin() {
  const [rows, template, settings] = await Promise.all([listConventions(), activeTemplate(), getSettings()]);

  return (
    <>
      <PageHeader
        title="Conventions de prêt"
        description="Chaque réservation génère sa convention, pré-remplie et acceptée en ligne par la direction de l'école. Le texte signé est conservé tel quel."
      />

      <section className="mb-12">
        {!rows.length ? (
          <EmptyState icon={<FileText className="size-8" />} title="Aucune convention pour le moment" />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">N°</th>
                  <th className="px-5 py-3 font-bold">École</th>
                  <th className="px-5 py-3 font-bold">Mallette · période</th>
                  <th className="px-5 py-3 font-bold">Statut</th>
                  <th className="px-5 py-3 font-bold">Signataire</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ convention: c, item, period, school }) => (
                  <tr key={c.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 font-bold tabular-nums">{conventionNumber(c)}</td>
                    <td className="px-5 py-3 font-semibold">{school.name}</td>
                    <td className="px-5 py-3 text-ink-2">
                      {item.name}
                      <div className="text-xs text-muted">
                        Période {period.position} · {period.schoolYear}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-2">
                      {c.signerName ? (
                        <>
                          {c.signerName}
                          <div className="text-xs text-muted">{c.signedAt && formatStamp(c.signedAt)}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Link href={`/conventions/${c.id}`} className="font-bold text-accent hover:underline">
                        Voir
                      </Link>
                      <span className="mx-2 text-line-strong">·</span>
                      <a href={`/conventions/${c.id}/pdf`} target="_blank" rel="noopener" className="font-bold text-accent hover:underline">
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Modèle et informations</h2>
        <Disclosure
          summary={
            <div>
              <p className="font-bold">Modèle de convention</p>
              <p className="text-sm text-muted">
                Version {template.id} · {formatStamp(template.createdAt)} · {template.createdBy}
              </p>
            </div>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
            <ActionForm action={saveTemplateAction} submitLabel="Enregistrer une nouvelle version">
              <Field label="Texte" hint="# titre · ## article · - liste · **gras**. Les champs entre {{ }} sont remplis automatiquement.">
                <Textarea name="body" defaultValue={template.body} className="min-h-[32rem] font-mono text-[13px] leading-relaxed" />
              </Field>
            </ActionForm>
            <div className="space-y-4">
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Champs automatiques</p>
                <ul className="space-y-1.5 text-[13px]">
                  {PLACEHOLDERS.map(([k, label]) => (
                    <li key={k}>
                      <code className="rounded bg-highlight px-1 font-mono text-[12px]">{`{{${k}}}`}</code>
                      <span className="block text-muted">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <form action={resetTemplateAction}>
                <ConfirmSubmit
                  message="Rétablir le modèle par défaut ? Une nouvelle version sera créée ; les conventions existantes ne changent pas."
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-2 hover:underline"
                >
                  <RotateCcw className="size-3.5" /> Rétablir le modèle par défaut
                </ConfirmSubmit>
              </form>
            </div>
          </div>
        </Disclosure>

        <Disclosure summary={<p className="font-bold">Aperçu du modèle</p>}>
          <ConventionText html={toHtml(template.body)} className="max-w-3xl" />
        </Disclosure>

        <Disclosure
          summary={
            <div>
              <p className="font-bold">Prêteur et service informatique</p>
              <p className="text-sm text-muted">
                {settings.lenderName} · {settings.itService}
              </p>
            </div>
          }
        >
          <ActionForm action={saveLenderAction} submitLabel="Enregistrer">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Prêteur">
                <Input name="lenderName" defaultValue={settings.lenderName} />
              </Field>
              <Field label="Adresse du prêteur">
                <Input name="lenderAddress" defaultValue={settings.lenderAddress} />
              </Field>
              <Field label="Représenté par" hint="Ex. : Monsieur Abdelafid MOKHTARI, Maire">
                <Input name="lenderRepresentative" defaultValue={settings.lenderRepresentative} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Signataire pour le prêteur">
                  <Input name="lenderSignatoryName" defaultValue={settings.lenderSignatoryName} />
                </Field>
                <Field label="Qualité">
                  <Input name="lenderSignatoryTitle" defaultValue={settings.lenderSignatoryTitle} />
                </Field>
              </div>
              <Field label="Service chargé de la livraison et de la reprise">
                <Input name="itService" defaultValue={settings.itService} />
              </Field>
              <Field label="Contact du service (téléphone, e-mail)">
                <Input name="itContact" defaultValue={settings.itContact} />
              </Field>
            </div>
          </ActionForm>
        </Disclosure>
      </section>
    </>
  );
}
