import { currentUser } from "@/lib/auth";
import { conventionPdf, getConvention } from "@/lib/conventions";

export const dynamic = "force-dynamic";

/** PDF d'une convention : réservé à l'école concernée et aux administrateurs. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Connexion requise", { status: 401 });
  const c = await getConvention(id);
  if (!c || !(user.admin || user.school?.id === c.school.id)) return new Response("Introuvable", { status: 404 });
  const pdf = await conventionPdf(id);
  if (!pdf) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
