"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { acceptSheetAction, type ActionResult } from "@/app/actions";
import { SignaturePad } from "@/components/signature-form";
import { Alert, Button, Input } from "@/components/ui";

export function AcceptForm({ token, step, defaultName }: { token: string; step: "delivery" | "return"; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [accepted, setAccepted] = useState(false);
  const [withSignature, setWithSignature] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [res, setRes] = useState<ActionResult>(null);
  const router = useRouter();
  const word = step === "delivery" ? "remise" : "reprise";

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const r = await acceptSheetAction(token, step, { accepted, name, signatureImage: withSignature ? image : null });
        setRes(r);
        setPending(false);
        if (r?.ok) router.refresh();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="acceptName" className="text-sm font-bold">
          Votre nom
        </label>
        <Input id="acceptName" required value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" autoComplete="name" />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setWithSignature((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline"
          aria-expanded={withSignature}
        >
          <PenLine className="size-4" /> {withSignature ? "Ne pas signer à la main" : "Signer à la main (facultatif)"}
        </button>
        {withSignature && (
          <div className="mt-3">
            <SignaturePad onChange={setImage} />
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line-strong bg-surface-2/60 p-4 text-[15px]">
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
        <span>
          <span className="font-bold">Je confirme l&apos;état du matériel constaté à la {word}</span>
          <span className="block text-sm text-muted">tel qu&apos;indiqué sur cette fiche de prêt. Cette confirmation vaut signature.</span>
        </span>
      </label>

      {res && !res.ok && <Alert tone="danger">{res.message}</Alert>}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending || !accepted || !name.trim() || (withSignature && !image)}>
        {pending && <Loader2 className="size-4 animate-spin" />} Confirmer la {word}
      </Button>
    </form>
  );
}
