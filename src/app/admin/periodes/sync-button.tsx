"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { syncNowAction } from "../actions";
import type { ActionResult } from "@/app/actions";
import { Alert, Button } from "@/components/ui";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setRes(await syncNowAction());
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Lire les dates maintenant
      </Button>
      {res && <Alert tone={res.ok ? "ok" : "danger"} className="py-2 text-xs">{res.message}</Alert>}
    </div>
  );
}
