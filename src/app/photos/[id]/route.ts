import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Sert la photo d'une mallette envoyée depuis l'admin. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const [p] = await db.select().from(schema.itemPhotos).where(eq(schema.itemPhotos.itemId, id));
  if (!p) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(p.data), {
    headers: {
      "Content-Type": p.mime,
      // l'URL contient ?v=<date de mise à jour> : on peut mettre en cache longtemps
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
