"use client";

import { useActionState } from "react";
import { saveProfileAction, type ActionResult } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Alert, Field, Input, Textarea } from "@/components/ui";

export function ProfileForm({ first, initial }: { first: boolean; initial: { name: string; address: string; contactName: string; phone: string } }) {
  const [state, action] = useActionState<ActionResult, FormData>(saveProfileAction, null);
  return (
    <form action={action} className="space-y-5">
      {first && <input type="hidden" name="first" value="1" />}
      <Field label="Nom de l'école" htmlFor="name">
        <Input id="name" name="name" required defaultValue={initial.name} placeholder="École élémentaire Jules Ferry" />
      </Field>
      <Field label="Adresse de livraison" htmlFor="address" hint="Indiquez l'adresse complète et, si besoin, les consignes d'accès.">
        <Textarea id="address" name="address" required defaultValue={initial.address} placeholder={"12 rue des Écoles\n60110 Méru"} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Personne à contacter" htmlFor="contactName">
          <Input id="contactName" name="contactName" defaultValue={initial.contactName} placeholder="Mme Dupont, directrice" />
        </Field>
        <Field label="Téléphone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={initial.phone} placeholder="03 44 00 00 00" />
        </Field>
      </div>
      {state && <Alert tone={state.ok ? "ok" : "danger"}>{state.message}</Alert>}
      <SubmitButton pendingLabel="Enregistrement…">{first ? "Continuer vers le planning" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
