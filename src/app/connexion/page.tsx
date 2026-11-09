import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await currentUser()) redirect("/");
  const { erreur } = await searchParams;
  const settings = await getSettings();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand name={settings.appName} />
        </div>
        <Card className="p-7">
          <h1 className="mb-1 text-xl font-semibold tracking-tight">Connexion</h1>
          <p className="mb-6 text-[15px] text-muted">Réservez le matériel pédagogique pour votre école.</p>
          <LoginForm initialError={erreur === "lien" ? "Ce lien de connexion n'est plus valable. Demandez-en un nouveau." : undefined} />
        </Card>
      </div>
    </main>
  );
}
