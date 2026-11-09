import Link from "next/link";
import { peekLoginToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { NotebookPage } from "@/components/notebook";
import { SubmitButton } from "@/components/client";
import { buttonClass } from "@/components/ui";
import { consumeLoginAction } from "../../actions";

export const metadata = { title: "Connexion" };

/** Page intermédiaire : évite que les antivirus de messagerie consomment le lien en le pré-visitant. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const email = token ? await peekLoginToken(token) : null;
  const settings = await getSettings();
  return (
    <NotebookPage appName={settings.appName}>
      <div className="text-center">
          {email ? (
            <>
              <p className="font-hand text-5xl leading-none text-accent">Bienvenue !</p>
              <p className="mt-2 text-[15px] text-muted">
                Connexion en tant que <span className="font-semibold text-ink">{email}</span>
              </p>
              <form action={consumeLoginAction} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <SubmitButton className="w-full" pendingLabel="Connexion…">
                  Continuer
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold tracking-tight">Lien expiré</h1>
              <p className="mt-2 text-[15px] text-muted">Ce lien de connexion a déjà été utilisé ou n&apos;est plus valable.</p>
              <Link href="/connexion" className={buttonClass("primary", "md", "mt-6 w-full")}>
                Recevoir un nouveau lien
              </Link>
            </>
          )}
      </div>
    </NotebookPage>
  );
}
