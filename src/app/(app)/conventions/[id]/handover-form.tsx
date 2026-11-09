"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions";
import { recordDeliveryAction, recordReturnAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Alert, Field, Input, Select } from "@/components/ui";
import { STATES, type LoanLine } from "@/lib/inventory";

export function HandoverForm({
  kind,
  id,
  sheet,
  defaults,
  canEmail,
}: {
  kind: "delivery" | "return";
  id: string;
  sheet: LoanLine[];
  defaults: { at: string; by: string; note: string };
  canEmail: boolean;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(kind === "delivery" ? recordDeliveryAction : recordReturnAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="lines" value={sheet.length} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Date">
          <Input type="date" name="at" required defaultValue={defaults.at} />
        </Field>
        <Field label="Pour le prêteur">
          <Input name="by" required defaultValue={defaults.by} />
        </Field>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 font-bold">Matériel</th>
              <th className="px-3 py-2 font-bold">{kind === "delivery" ? "État à la remise" : "État à la reprise"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sheet.map((l, i) => {
              const current = (kind === "delivery" ? l.stateOut ?? l.state : l.stateIn ?? l.stateOut ?? l.state) || "";
              return (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{l.label}</span>
                    {l.serial && <span className="ml-2 font-mono text-xs text-muted">{l.serial}</span>}
                  </td>
                  <td className="w-52 px-3 py-1.5">
                    <Select name={`state-${i}`} defaultValue={current} className="h-9 text-sm">
                      <option value="">—</option>
                      {[...new Set([current, ...STATES])].filter(Boolean).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Field label="Observation">
        <Input name="note" defaultValue={defaults.note} />
      </Field>
      <label className="flex items-center gap-2.5 text-sm font-semibold text-ink-2">
        <input type="checkbox" name="send" defaultChecked={canEmail} disabled={!canEmail} className="size-4 accent-[var(--accent)]" />
        Envoyer la fiche à l&apos;école pour confirmation
        {!canEmail && <span className="font-normal text-muted">(pas d&apos;adresse e-mail : faites confirmer sur place)</span>}
      </label>
      {state && (
        <Alert tone={state.ok ? "ok" : "danger"}>
          {state.message}
          {state.link && (
            <>
              {" "}
              <a href={state.link} target="_blank" rel="noopener" className="font-bold underline">
                Mode test : ouvrir le lien
              </a>
            </>
          )}
        </Alert>
      )}
      <SubmitButton>{kind === "delivery" ? "Enregistrer la remise" : "Enregistrer la reprise"}</SubmitButton>
    </form>
  );
}
