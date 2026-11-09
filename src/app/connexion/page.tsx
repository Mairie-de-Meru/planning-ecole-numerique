import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { NotebookPage, Steps } from "@/components/notebook";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await currentUser()) redirect("/");
  const { erreur } = await searchParams;
  const settings = await getSettings();
  return (
    <NotebookPage appName={settings.appName} aside={<Steps />}>
      <h1 className="text-2xl font-extrabold tracking-tight">
        <span className="highlight">Connexion</span>
      </h1>
      <p className="mb-6 mt-2 text-[15px] text-muted">Entrez l&apos;adresse e-mail de votre école : vous recevrez un lien pour vous connecter.</p>
      <LoginForm initialError={erreur === "lien" ? "Ce lien de connexion n'est plus valable. Demandez-en un nouveau." : undefined} />
    </NotebookPage>
  );
}
