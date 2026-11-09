"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/app/actions";
import { SubmitButton } from "./client";
import { Alert, cx } from "./ui";

export function ActionForm({
  action,
  children,
  submitLabel,
  submitVariant = "primary",
  className,
  resetOnSuccess = false,
  inline = false,
}: {
  action: (state: ActionResult, form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cx(inline ? "flex flex-col gap-3 sm:flex-row sm:items-end" : "space-y-5", className)}>
      {children}
      {state && !inline && <Alert tone={state.ok ? "ok" : "danger"}>{state.message}</Alert>}
      <div className={inline ? "shrink-0" : undefined}>
        <SubmitButton variant={submitVariant} pendingLabel="…">
          {submitLabel}
        </SubmitButton>
      </div>
      {state && inline && <Alert tone={state.ok ? "ok" : "danger"} className="sm:hidden">{state.message}</Alert>}
    </form>
  );
}
