"use client";

import { useState, useTransition } from "react";
import { Loader2, Send, Tablet } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { sendLoanSheetAction, sheetLinkAction } from "@/app/admin/actions";
import { Alert, Button } from "./ui";

/** Un clic : envoyer la fiche de prêt à l'école, ou l'ouvrir pour la faire confirmer sur place. */
export function SheetButtons({ conventionId, canEmail, size = "md" }: { conventionId: string; canEmail: boolean; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"send" | "open" | null>(null);
  const [res, setRes] = useState<ActionResult>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size={size}
          disabled={pending || !canEmail}
          title={canEmail ? undefined : "L'école n'a pas encore d'adresse e-mail"}
          onClick={() =>
            start(async () => {
              setWhich("send");
              setRes(await sendLoanSheetAction(conventionId));
            })
          }
        >
          {pending && which === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Envoyer à l&apos;école
        </Button>
        <Button
          size={size}
          variant="secondary"
          disabled={pending}
          onClick={() => {
            // fenêtre ouverte dans le geste de l'utilisateur, l'adresse est fixée après
            const w = window.open("about:blank", "_blank");
            start(async () => {
              setWhich("open");
              const r = await sheetLinkAction(conventionId);
              if (r?.ok && r.link && w) w.location.href = r.link;
              else {
                w?.close();
                setRes(r);
              }
            });
          }}
        >
          {pending && which === "open" ? <Loader2 className="size-4 animate-spin" /> : <Tablet className="size-4" />} Faire confirmer sur place
        </Button>
      </div>
      {res && (
        <Alert tone={res.ok ? "ok" : "danger"} className="py-2 text-xs">
          {res.message}
          {res.link && (
            <>
              {" "}
              <a href={res.link} target="_blank" rel="noopener" className="font-bold underline">
                Mode test : ouvrir le lien
              </a>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
