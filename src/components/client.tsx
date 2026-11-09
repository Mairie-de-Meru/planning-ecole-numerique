"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { buttonClass, cx } from "./ui";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, size, className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  color,
}: {
  color?: string;
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-2xl",
        size === "md" ? "max-w-md" : "max-w-xl",
      )}
    >
      {open && (
        <div className="relative p-6 pt-7">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: color ?? "var(--accent)" }} />
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-xl font-extrabold leading-snug tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} className="-m-1.5 rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Fermer">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmSubmit({ message, children, className }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
