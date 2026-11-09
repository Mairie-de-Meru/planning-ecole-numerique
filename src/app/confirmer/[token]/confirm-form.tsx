"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleCheck, CircleAlert } from "lucide-react";
import { confirmAction, type ActionResult } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { buttonClass } from "@/components/ui";
import { frLong } from "@/lib/dates";

export function ConfirmForm({ token, children }: { token: string; children: React.ReactNode }) {
  const [state, action] = useActionState<ActionResult, FormData>(confirmAction, null);
  if (state?.ok) {
    const [item, label, start, end] = state.message.split("|");
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
          <CircleCheck className="size-6" />
        </div>
        <h1 className=" text-xl font-extrabold tracking-tight">Réservation confirmée</h1>
        <p className="mt-2 text-[15px] text-muted">
          « {item} » est réservée pour la période {label}, du {frLong(start)} au {frLong(end)}. Un e-mail récapitulatif vous a été envoyé.
        </p>
        <Link href="/reservations" className={buttonClass("primary", "md", "mt-6 w-full")}>
          Voir mes réservations
        </Link>
      </div>
    );
  }
  return (
    <form action={action}>
      {children}
      {state && !state.ok && (
        <div role="alert" className="mt-5 flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-left text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {state.message}
        </div>
      )}
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="mt-6 w-full" pendingLabel="Confirmation…">
        Confirmer la réservation
      </SubmitButton>
    </form>
  );
}
