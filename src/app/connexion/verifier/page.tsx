import Link from "next/link";
import { peekLoginToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/brand";
import { SubmitButton } from "@/components/client";
import { Card, buttonClass } from "@/components/ui";
import { consumeLoginAction } from "../../actions";

export const metadata = { title: "Connexion" };

/** Page intermédiaire : évite que les antivirus de messagerie consomment le lien en le pré-visitant. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const email = token ? await peekLoginToken(token) : null;
  const settings = await getSettings();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand name={settings.appName} />
        </div>
        <Card className="p-7 text-center">
          {email ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Bienvenue</h1>
              <p className="mt-2 text-[15px] text-muted">
                Connexion en tant que <span className="font-medium text-ink">{email}</span>
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
              <h1 className="text-xl font-semibold tracking-tight">Lien expiré</h1>
              <p className="mt-2 text-[15px] text-muted">Ce lien de connexion a déjà été utilisé ou n&apos;est plus valable.</p>
              <Link href="/connexion" className={buttonClass("primary", "md", "mt-6 w-full")}>
                Recevoir un nouveau lien
              </Link>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
