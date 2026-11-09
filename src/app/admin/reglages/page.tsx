import { db, schema } from "@/db";
import { envAdminEmails, getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import { smtpConfigured } from "@/lib/mail";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { addAdminAction, removeAdminAction, saveSettingsAction } from "../actions";

export const metadata = { title: "Réglages" };

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--accent)]" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default async function SettingsPage() {
  const me = await requireAdmin();
  const s = await getSettings();
  const dbAdmins = await db.select().from(schema.admins);
  const envAdmins = envAdminEmails();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Réglages" />
      <Card className="p-6 sm:p-8">
        <ActionForm action={saveSettingsAction} submitLabel="Enregistrer les réglages">
          <Field label="Nom de l'application"><Input name="appName" defaultValue={s.appName} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Zone scolaire" hint="Changer de zone affiche les périodes de cette zone.">
              <Select name="zone" defaultValue={s.zone}>
                <option value="A">Zone A</option>
                <option value="B">Zone B</option>
                <option value="C">Zone C</option>
              </Select>
            </Field>
            <Field label="Délai de confirmation (minutes)" hint="Passé ce délai, une réservation non confirmée est libérée.">
              <Input name="confirmTtlMinutes" type="number" min={5} max={1440} defaultValue={s.confirmTtlMinutes} />
            </Field>
          </div>
          <Field label="Mallettes par école et par période" hint="0 = illimité.">
            <Input name="maxPerSchoolPerPeriod" type="number" min={0} max={50} defaultValue={s.maxPerSchoolPerPeriod} className="sm:max-w-40" />
          </Field>
          <Field label="Source des dates de vacances">
            <Input name="sourceUrl" type="url" defaultValue={s.sourceUrl} />
          </Field>
          <div className="space-y-4 rounded-xl bg-surface-2 p-4">
            <Toggle name="syncEnabled" label="Lire les dates automatiquement chaque semaine" hint="Les changements sont proposés dans l'onglet Périodes, jamais appliqués sans vous." defaultChecked={s.syncEnabled} />
            <Toggle
              name="splitJune"
              label="Découper la dernière période en deux (fin mai / juin)"
              hint="Six périodes par an, comme dans les conventions : printemps → fin mai, puis juin → été."
              defaultChecked={s.splitJune}
            />
            <Toggle name="notifyAdmin" label="M'avertir par e-mail des réservations" hint="Nouvelle réservation, décalage ou annulation par une école." defaultChecked={s.notifyAdmin} />
          </div>
        </ActionForm>
      </Card>

      <h2 className="mb-3 mt-12 font-semibold">Administrateurs</h2>
      <Card className="p-6 sm:p-8">
        <ul className="mb-6 divide-y divide-line">
          {envAdmins.map((e) => (
            <li key={e} className="flex items-center justify-between py-2.5 text-sm">
              {e} <Badge>défini dans la configuration</Badge>
            </li>
          ))}
          {dbAdmins.filter((a) => !envAdmins.includes(a.email)).map((a) => (
            <li key={a.email} className="flex items-center justify-between py-2.5 text-sm">
              {a.email}
              {a.email !== me.email && (
                <form action={removeAdminAction}>
                  <input type="hidden" name="email" value={a.email} />
                  <button className="text-danger hover:underline">Retirer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={addAdminAction} submitLabel="Ajouter" submitVariant="secondary" resetOnSuccess>
          <Field label="Ajouter un administrateur"><Input name="email" type="email" placeholder="gestionnaire@mairie.fr" /></Field>
        </ActionForm>
      </Card>

      <h2 className="mb-3 mt-12 font-semibold">Envoi des e-mails</h2>
      <Card className="p-6 text-sm sm:p-8">
        {smtpConfigured() ? (
          <p>
            <Badge tone="ok">Configuré</Badge> <span className="ml-2 text-ink-2">Serveur {process.env.SMTP_HOST}, expéditeur {process.env.MAIL_FROM ?? process.env.SMTP_USER}.</span>
          </p>
        ) : (
          <p className="text-ink-2">
            <Badge tone="warn">Non configuré</Badge>
            <span className="ml-2">Renseignez SMTP_HOST, SMTP_USER, SMTP_PASS et MAIL_FROM dans les variables d&apos;environnement de l&apos;hébergeur (voir README).</span>
          </p>
        )}
      </Card>
    </div>
  );
}
