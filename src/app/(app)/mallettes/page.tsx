import { catalog } from "@/lib/planning-data";
import { Thumb } from "@/components/thumb";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Les mallettes" };

export default async function CatalogPage() {
  const items = await catalog();
  return (
    <>
      <PageHeader
        title="Les mallettes"
        description="Le matériel que vous pouvez emprunter. Chaque mallette est prêtée pour une période entière et livrée à l'école."
        actions={<LinkButton href="/">Voir les disponibilités</LinkButton>}
      />
      {!items.length ? (
        <EmptyState title="Aucune mallette pour le moment" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-card">
              <div className="relative border-b border-line bg-white">
                <Thumb src={item.photoUrl} color={item.color} alt={item.name} className="aspect-[16/10] w-full !rounded-none !border-0" />
                <span className="absolute left-0 top-4 h-6 w-1.5 rounded-r-full" style={{ background: item.color }} />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-lg font-extrabold leading-snug">{item.name}</h2>
                {item.description && <p className="mt-0.5 text-sm font-bold text-muted">{item.description}</p>}
                {item.contents && <p className="mt-3 text-sm leading-relaxed text-ink-2">{item.contents}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
