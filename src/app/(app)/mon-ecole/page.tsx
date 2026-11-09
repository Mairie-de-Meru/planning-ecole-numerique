import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mon école" };

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ premiere?: string }> }) {
  const user = await requireUser();
  const { premiere } = await searchParams;
  const first = premiere === "1" || !user.school?.name;
  const s = user.school;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={first ? "Présentez votre école" : "Mon école"}
        description={
          <>
            Ces informations servent à la livraison des mallettes. Compte : <span className="font-semibold text-ink">{user.email}</span>
          </>
        }
      />
      <Card className="p-6 sm:p-8">
        <ProfileForm first={first} initial={{ name: s?.name ?? "", address: s?.address ?? "", contactName: s?.contactName ?? "", phone: s?.phone ?? "" }} />
      </Card>
    </div>
  );
}
