"use client";

import { useActionState } from "react";
import { deletePeriodAction } from "../actions";
import type { ActionResult } from "@/app/actions";
import { Alert } from "@/components/ui";

export function DeletePeriod({ id }: { id: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(deletePeriodAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Supprimer cette période ?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-danger hover:underline">Supprimer la période</button>
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
    </form>
  );
}
