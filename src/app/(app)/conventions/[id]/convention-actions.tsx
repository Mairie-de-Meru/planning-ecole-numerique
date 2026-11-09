"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Mail } from "lucide-react";
import { sendConventionAction, signConventionAction, type ActionResult } from "@/app/actions";
import { SignatureForm } from "@/components/signature-form";
import { Alert, Button, buttonClass } from "@/components/ui";

export function ConventionToolbar({ id, canEmail }: { id: string; canEmail: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <a href={`/conventions/${id}/pdf`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
          <Download className="size-4" /> PDF
        </a>
        {canEmail && (
          <Button variant="secondary" disabled={pending} onClick={() => start(async () => setRes(await sendConventionAction(id)))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Recevoir par e-mail
          </Button>
        )}
      </div>
      {res && <Alert tone={res.ok ? "ok" : "danger"} className="py-2 text-xs">{res.message}</Alert>}
    </div>
  );
}

export function SignConvention({ id, defaults }: { id: string; defaults: { signerName: string; signerTitle: string; storageLocation?: string } }) {
  const router = useRouter();
  return (
    <SignatureForm
      defaults={defaults}
      submitLabel="Signer la convention"
      onSubmit={async (sign) => {
        const r = await signConventionAction(id, sign);
        if (r?.ok) router.refresh();
        return r;
      }}
    />
  );
}
