"use client";

import { useActionState, useState } from "react";
import { saveProfileAction, type ActionResult } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { SIGNER_TITLES } from "@/components/signature-form";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";

type Profile = { name: string; address: string; contactName: string; phone: string; directorName: string; directorTitle: string };
type Claimable = Profile & { id: string };

export function ProfileForm({ first, initial, claimable = [] }: { first: boolean; initial: Profile; claimable?: Claimable[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(saveProfileAction, null);
  const [claimId, setClaimId] = useState(claimable.length ? "" : "new");
  const current = claimable.find((c) => c.id === claimId) ?? initial;
  const showFields = !claimable.length || claimId !== "";

  return (
    <form action={action} className="space-y-5">
      {first && <input type="hidden" name="first" value="1" />}
      {claimable.length > 0 && (
        <Field label="Votre école" htmlFor="claim" hint="Les écoles maternelles de la ville sont déjà enregistrées : choisissez la vôtre.">
          <Select id="claim" value={claimId} onChange={(e) => setClaimId(e.target.value)} required>
            <option value="" disabled>
              Choisir une école…
            </option>
            {claimable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="new">Mon école n&apos;est pas dans la liste</option>
          </Select>
        </Field>
      )}
      <input type="hidden" name="claimId" value={claimId === "new" ? "" : claimId} />

      {showFields && (
        <div key={claimId} className="space-y-5">
          <Field label="Nom de l'école" htmlFor="name">
            <Input id="name" name="name" required defaultValue={current.name} placeholder="École maternelle …" />
          </Field>
          <Field label="Adresse de livraison" htmlFor="address" hint="La mallette est livrée et reprise à cette adresse par le service informatique.">
            <Textarea id="address" name="address" required defaultValue={current.address} placeholder={"1 rue de l'École\n60110 Méru"} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
            <Field label="Directrice ou directeur" htmlFor="directorName" hint="Signataire des conventions de prêt.">
              <Input id="directorName" name="directorName" required defaultValue={current.directorName} placeholder="Prénom NOM" />
            </Field>
            <Field label="Fonction" htmlFor="directorTitle">
              <Select id="directorTitle" name="directorTitle" defaultValue={current.directorTitle || "Directrice"}>
                {[...new Set([current.directorTitle, ...SIGNER_TITLES])].filter(Boolean).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Autre contact (facultatif)" htmlFor="contactName">
              <Input id="contactName" name="contactName" defaultValue={current.contactName} placeholder="Enseignant référent" />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" defaultValue={current.phone} placeholder="03 44 00 00 00" />
            </Field>
          </div>
        </div>
      )}
      {state && <Alert tone={state.ok ? "ok" : "danger"}>{state.message}</Alert>}
      <SubmitButton pendingLabel="Enregistrement…">{first ? "Continuer vers le planning" : "Enregistrer"}</SubmitButton>
    </form>
  );
}
