import { conventionPdf, getBySheetToken } from "@/lib/conventions";

export const dynamic = "force-dynamic";

/** PDF de la convention et de sa fiche de prêt, accessible avec le lien de la fiche. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const full = await getBySheetToken(token);
  if (!full) return new Response("Lien expiré", { status: 404 });
  const pdf = await conventionPdf(full.convention.id);
  if (!pdf) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
