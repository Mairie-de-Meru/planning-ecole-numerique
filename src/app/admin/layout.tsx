import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <AppHeader user={user} appName={settings.appName} section="admin" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
