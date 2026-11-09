import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { ActionForm } from "@/components/action-form";
import { Disclosure } from "@/components/disclosure";
import { Badge, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { deleteItemAction, saveItemAction } from "../actions";
import type { Item } from "@/db/schema";
import { CRAYONS, crayonFor } from "@/lib/colors";

export const metadata = { title: "Valises" };

function ColorPicker({ value, fallbackIndex }: { value?: string | null; fallbackIndex: number }) {
  const current = value ?? CRAYONS[fallbackIndex % CRAYONS.length].key;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold">Couleur dans le planning</legend>
      <div className="flex flex-wrap gap-2">
        {CRAYONS.map((c) => (
          <label key={c.key} title={c.label} className="cursor-pointer">
            <input type="radio" name="color" value={c.key} defaultChecked={current === c.key} className="peer sr-only" />
            <span
              className="block size-8 rounded-lg border-2 border-transparent ring-offset-2 ring-offset-[var(--surface)] transition peer-checked:ring-2 peer-checked:ring-[var(--ink)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
              style={{ background: c.hex }}
            />
            <span className="sr-only">{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ItemFields({ item, index = 0 }: { item?: Item; index?: number }) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field label="Nom">
          <Input name="name" required defaultValue={item?.name} placeholder="Valise tablettes n°1" />
        </Field>
        <Field label="Ordre">
          <Input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Description courte" hint="Affichée dans le planning.">
        <Input name="description" defaultValue={item?.description} placeholder="15 tablettes, cycle 3" />
      </Field>
      <Field label="Contenu détaillé">
        <Textarea name="contents" defaultValue={item?.contents} placeholder="15 tablettes, chargeur multiple, coques, guide pédagogique…" />
      </Field>
      <ColorPicker value={item?.color} fallbackIndex={index} />
      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="size-4 accent-[var(--accent)]" />
        Proposée à la réservation
      </label>
    </>
  );
}

export default async function ItemsPage() {
  const items = await db.select().from(schema.items).orderBy(asc(schema.items.sortOrder), asc(schema.items.name));
  return (
    <>
      <PageHeader eyebrow="Le matériel" title="Valises" description="Le matériel proposé aux écoles. Chaque valise se réserve pour une période entière." />
      <div className="space-y-3">
        <Disclosure
          summary={
            <span className="inline-flex items-center gap-2 font-semibold text-accent">
              <Plus className="size-4" /> Ajouter une valise
            </span>
          }
        >
          <ActionForm action={saveItemAction} submitLabel="Ajouter" resetOnSuccess>
            <ItemFields index={items.length} />
          </ActionForm>
        </Disclosure>
        {items.map((item, index) => (
          <Disclosure
            key={item.id}
            summary={
              <div className="flex items-center gap-3">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: crayonFor(item.color, index) }} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{item.name}</div>
                  {item.description && <div className="truncate text-sm text-muted">{item.description}</div>}
                </div>
                {!item.active && <Badge>Masquée</Badge>}
              </div>
            }
          >
            <ActionForm action={saveItemAction} submitLabel="Enregistrer">
              <ItemFields item={item} index={index} />
            </ActionForm>
            <form action={deleteItemAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="text-sm text-danger hover:underline">
                Supprimer (ou masquer si elle a déjà été réservée)
              </button>
            </form>
          </Disclosure>
        ))}
      </div>
    </>
  );
}
