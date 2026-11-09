"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eraser, ImageUp, Loader2, PenLine } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import type { SignInput } from "@/lib/conventions";
import { Alert, Button, Input, Select, cx } from "./ui";

export const SIGNER_TITLES = ["Directrice", "Directeur", "Directrice par intérim", "Directeur par intérim", "Faisant fonction de direction"];

/** Zone de signature : dessin au doigt / à la souris, ou image glissée-déposée. Exporte un PNG. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d2742";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const commit = () => {
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };
  const loadImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current!;
      const ctx = c.getContext("2d")!;
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      ctx.clearRect(0, 0, c.width, c.height);
      const scale = Math.min((w - 16) / img.width, (h - 16) / img.height, 1);
      ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
      URL.revokeObjectURL(img.src);
      commit();
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div>
      <div
        className={cx(
          "relative h-36 overflow-hidden rounded-xl border bg-white transition",
          over ? "border-accent ring-4 ring-accent/15" : "border-dashed border-line-strong",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) loadImage(f);
        }}
      >
        <canvas
          ref={canvas}
          aria-label="Zone de signature"
          className="absolute inset-0 size-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            drawing.current = true;
            canvas.current!.setPointerCapture(e.pointerId);
            const ctx = canvas.current!.getContext("2d")!;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvas.current!.getContext("2d")!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            setEmpty(false);
          }}
          onPointerUp={() => {
            if (drawing.current) commit();
            drawing.current = false;
          }}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-[13px] font-semibold text-muted">
            <PenLine className="size-5" />
            Signez ici, ou glissez-déposez une image de votre signature
          </div>
        )}
        <div className="absolute inset-x-6 bottom-6 border-b border-line" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
          <ImageUp className="size-4" /> Importer une image
        </Button>
        {!empty && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser className="size-4" /> Effacer
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadImage(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function ConventionText({ html, className }: { html: string; className?: string }) {
  return <div className={cx("convention", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SignatureForm({
  html,
  defaults,
  submitLabel,
  onSubmit,
  footer,
}: {
  html?: string | null;
  defaults: { signerName: string; signerTitle: string };
  submitLabel: string;
  onSubmit: (sign: SignInput) => Promise<ActionResult>;
  footer?: ReactNode;
}) {
  const [name, setName] = useState(defaults.signerName);
  const [title, setTitle] = useState(defaults.signerTitle || "Directrice");
  const [accepted, setAccepted] = useState(false);
  const [emailCopy, setEmailCopy] = useState(false);
  const [withSignature, setWithSignature] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const r = await onSubmit({ accepted, signerName: name, signerTitle: title, signatureImage: withSignature ? image : null, emailCopy });
        setResult(r);
        setPending(false);
      }}
    >
      {html !== undefined && (
        <div className="max-h-[38vh] overflow-y-auto rounded-xl border border-line-strong bg-surface px-5 py-4 text-ink shadow-inner">
          {html ? <ConventionText html={html} /> : <div className="flex justify-center py-10 text-muted"><Loader2 className="size-5 animate-spin" /></div>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
        <div className="space-y-1.5">
          <label htmlFor="signer" className="text-sm font-bold">Signataire</label>
          <Input id="signer" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom NOM" autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="signerTitle" className="text-sm font-bold">Fonction</label>
          <Select id="signerTitle" value={title} onChange={(e) => setTitle(e.target.value)}>
            {[...new Set([title, ...SIGNER_TITLES])].filter(Boolean).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2.5 text-sm font-semibold text-ink-2">
          <input type="checkbox" checked={withSignature} onChange={(e) => setWithSignature(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Ajouter ma signature manuscrite <span className="font-normal text-muted">(facultatif)</span>
        </label>
        {withSignature && (
          <div className="mt-3">
            <SignaturePad onChange={setImage} />
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-line-strong bg-surface-2/60 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]" />
          <span>
            <span className="font-bold text-ink">J&apos;ai lu et j&apos;accepte la convention de prêt.</span>{" "}
            <span className="text-muted">Cette validation vaut signature ; la date et l&apos;heure sont enregistrées.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={emailCopy} onChange={(e) => setEmailCopy(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]" />
          <span className="font-semibold text-ink-2">Recevoir la convention par e-mail (PDF)</span>
        </label>
      </div>

      {result && !result.ok && <Alert tone="danger">{result.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {footer}
        <Button type="submit" disabled={pending || !accepted || !name.trim() || (withSignature && !image)}>
          {pending && <Loader2 className="size-4 animate-spin" />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}
