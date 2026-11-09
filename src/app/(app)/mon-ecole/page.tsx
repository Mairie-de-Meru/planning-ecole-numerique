import { asc, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mon école" };

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ premiere?: string }> }) {
  const user = await requireUser();
  const { premiere } = await searchParams;
  const s = user.school;
  const first = premiere === "1" || !s?.name;
  const claimable = s
    ? []
    : (await db.select().from(schema.schools).where(isNull(schema.schools.email)).orderBy(asc(schema.schools.name))).map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        contactName: c.contactName,
        phone: c.phone,
        directorName: c.directorName,
        directorTitle: c.directorTitle,
      }));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={first ? "Présentez votre école" : "Mon école"}
        description={
          <>
            Ces informations servent à la livraison et pré-remplissent les conventions. Compte : <span className="font-semibold text-ink">{user.email}</span>
          </>
        }
      />
      <Card className="p-6 sm:p-8">
        <ProfileForm
          first={first}
          claimable={claimable}
          initial={{
            name: s?.name ?? "",
            address: s?.address ?? "",
            contactName: s?.contactName ?? "",
            phone: s?.phone ?? "",
            directorName: s?.directorName ?? "",
            directorTitle: s?.directorTitle ?? "Directrice",
          }}
        />
      </Card>
    </div>
  );
}
