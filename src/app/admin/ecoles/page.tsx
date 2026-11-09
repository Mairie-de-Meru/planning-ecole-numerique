import { asc } from "drizzle-orm";
import { Plus, X } from "lucide-react";
import { db, schema } from "@/db";
import type { School } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { Disclosure } from "@/components/disclosure";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { addAllowlistAction, removeAllowlistAction, saveSchoolAction } from "../actions";

export const metadata = { title: "Écoles" };

function SchoolFields({ s }: { s?: School }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom de l'école"><Input name="name" required defaultValue={s?.name} /></Field>
        <Field label="E-mail (identifiant de connexion)"><Input name="email" type="email" required defaultValue={s?.email} /></Field>
      </div>
      <Field label="Adresse de livraison"><Textarea name="address" defaultValue={s?.address} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Contact"><Input name="contactName" defaultValue={s?.contactName} /></Field>
        <Field label="Téléphone"><Input name="phone" defaultValue={s?.phone} /></Field>
      </div>
    </>
  );
}

export default async function SchoolsPage() {
  const allow = await db.select().from(schema.allowlist).orderBy(asc(schema.allowlist.pattern));
  const schools = await db.select().from(schema.schools).orderBy(asc(schema.schools.name));
  return (
    <>
      <PageHeader title="Écoles et accès" description="Seules les adresses de la liste blanche peuvent se connecter. Les écoles créent leur fiche à la première connexion." />

      <section className="mb-12">
        <h2 className="mb-3 font-semibold">Liste blanche</h2>
        <Card className="p-5 sm:p-6">
          <ActionForm action={addAllowlistAction} submitLabel="Ajouter" resetOnSuccess>
            <Field label="Adresses ou domaines" hint="Une ou plusieurs entrées séparées par des espaces, virgules ou retours à la ligne. « @ac-amiens.fr » autorise tout le domaine.">
              <Textarea name="patterns" className="min-h-20" placeholder={"ce.0601234a@ac-amiens.fr\n@ac-amiens.fr"} />
            </Field>
          </ActionForm>
          {allow.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              {allow.map((a) => (
                <li key={a.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm">
                  {a.pattern}
                  <form action={removeAllowlistAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="grid size-6 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Retirer ${a.pattern}`}>
                      <X className="size-3.5" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {!allow.length && <p className="mt-4 text-sm text-warn">La liste est vide : aucune école ne peut se connecter pour l&apos;instant.</p>}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Écoles ({schools.length})</h2>
        <div className="space-y-2">
          <Disclosure summary={<span className="inline-flex items-center gap-2 font-medium text-accent"><Plus className="size-4" /> Ajouter une école</span>}>
            <ActionForm action={saveSchoolAction} submitLabel="Ajouter" resetOnSuccess>
              <SchoolFields />
            </ActionForm>
          </Disclosure>
          {schools.map((s) => (
            <Disclosure
              key={s.id}
              summary={
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{s.name || <em className="font-normal text-muted">Fiche non remplie</em>}</span>
                  <span className="text-sm text-muted">{s.email}</span>
                </div>
              }
            >
              <ActionForm action={saveSchoolAction} submitLabel="Enregistrer">
                <SchoolFields s={s} />
              </ActionForm>
            </Disclosure>
          ))}
        </div>
      </section>
    </>
  );
}
