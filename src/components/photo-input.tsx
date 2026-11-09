"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { buttonClass } from "./ui";

export function PhotoInput() {
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <label className={buttonClass("secondary", "sm", "cursor-pointer")}>
        <ImagePlus className="size-4" /> Choisir une image
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <span className="truncate text-xs text-muted">{name ?? "Aucune image choisie"}</span>
    </div>
  );
}
