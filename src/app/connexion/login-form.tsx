"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestLoginAction, type ActionResult } from "../actions";
import { SubmitButton } from "@/components/client";
import { Alert, Field, Input } from "@/components/ui";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(requestLoginAction, null);

  if (state?.ok)
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-6" />
        </div>
        <h2 className="text-lg font-semibold">Vérifiez votre boîte mail</h2>
        <p className="mt-2 text-[15px] text-muted">
          Un lien de connexion a été envoyé à <span className="font-medium text-ink">{state.message}</span>. Il est valable 20 minutes.
        </p>
        {state.link && (
          <Alert tone="warn" className="mt-5 text-left">
            <strong>Mode test</strong> — aucun e-mail n&apos;est réellement envoyé.{" "}
            <a className="font-medium underline" href={state.link}>
              Ouvrir le lien de connexion
            </a>
          </Alert>
        )}
        <form action={action} className="mt-6">
          <input type="hidden" name="email" value={state.message} />
          <SubmitButton variant="ghost" size="sm" pendingLabel="Envoi…">
            Renvoyer le lien
          </SubmitButton>
        </form>
      </div>
    );

  return (
    <form action={action} className="space-y-5">
      {initialError && !state && <Alert tone="danger">{initialError}</Alert>}
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Adresse e-mail de l'école" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus placeholder="ce.0601234a@ac-amiens.fr" />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Envoi du lien…">
        Recevoir un lien de connexion
      </SubmitButton>
      <p className="text-center text-[13px] text-muted">Pas de mot de passe : un lien sécurisé vous est envoyé par e-mail.</p>
    </form>
  );
}
