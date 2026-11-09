import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Download, Truck } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { deliveries } from "@/lib/deliveries";
import { frLong, frRange, todayParis } from "@/lib/dates";
import { Card, EmptyState, PageHeader, buttonClass, cx } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata = { title: "Livraisons" };

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const settings = await getSettings();
  const periods = await db.select().from(schema.periods).where(eq(schema.periods.zone, settings.zone)).orderBy(asc(schema.periods.startDate));
  const { periode } = await searchParams;
  const today = todayParis();
  const selected = periods.find((p) => p.id === periode) ?? periods.find((p) => p.endDate >= today) ?? periods.at(-1);
  const rows = selected ? await deliveries(selected.id) : [];
  const around = selected ? periods.slice(Math.max(0, periods.indexOf(selected) - 2), periods.indexOf(selected) + 4) : [];

  return (
    <>
      <PageHeader
        title="Feuille de livraison"
        description="Valises à livrer en début de période et à récupérer à la fin (avant la maintenance des vacances)."
        actions={
          selected && (
            <>
              <a href={`/admin/livraisons/export?periode=${selected.id}`} className={buttonClass("secondary")}>
                <Download className="size-4" /> CSV
              </a>
              <PrintButton />
            </>
          )
        }
      />
      {!selected ? (
        <EmptyState icon={<Truck className="size-8" />} title="Aucune période" />
      ) : (
        <>
          <div className="no-print mb-6 flex flex-wrap gap-2">
            {around.map((p) => (
              <Link
                key={p.id}
                href={`/admin/livraisons?periode=${p.id}`}
                className={cx(
                  "rounded-xl border px-3.5 py-2 text-sm",
                  p.id === selected.id ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                <span className="font-medium">{p.label}</span> <span className="text-xs">· {frRange(p.startDate, p.endDate)} {p.schoolYear.slice(2, 4)}/{p.schoolYear.slice(7)}</span>
              </Link>
            ))}
          </div>
          <h2 className="mb-1 text-lg font-semibold">
            {selected.label} · {selected.schoolYear}
          </h2>
          <p className="mb-5 text-sm text-muted">
            Livraison à partir du {frLong(selected.startDate)} — retour le {frLong(selected.endDate)} · {rows.length} valise(s)
          </p>
          {!rows.length ? (
            <EmptyState icon={<Truck className="size-8" />} title="Aucune livraison sur cette période" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">École</th>
                    <th className="px-5 py-3 font-medium">Adresse de livraison</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Valise</th>
                    <th className="no-print px-5 py-3 font-medium">Livrée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ r, item, school }) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-5 py-3 font-medium">{school.name || school.email}</td>
                      <td className="whitespace-pre-line px-5 py-3 text-ink-2">{school.address}</td>
                      <td className="px-5 py-3 text-ink-2">
                        {school.contactName}
                        {school.phone && <div className="text-muted">{school.phone}</div>}
                        <div className="text-muted">{school.email}</div>
                      </td>
                      <td className="px-5 py-3">{item.name}</td>
                      <td className="no-print px-5 py-3"><input type="checkbox" aria-label="Livrée" className="size-4 accent-[var(--accent)]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
