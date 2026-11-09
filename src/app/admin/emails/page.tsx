import { desc } from "drizzle-orm";
import { Mail } from "lucide-react";
import { db, schema } from "@/db";
import { smtpConfigured } from "@/lib/mail";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui";
import { Disclosure } from "@/components/disclosure";

export const metadata = { title: "E-mails" };

export default async function EmailsPage() {
  const rows = await db.select().from(schema.mailLog).orderBy(desc(schema.mailLog.createdAt)).limit(100);
  return (
    <>
      <PageHeader title="Journal des e-mails" description="Les 100 derniers e-mails envoyés par l'application." />
      {!smtpConfigured() && (
        <Alert tone="warn" className="mb-6">
          Aucun serveur d&apos;envoi (SMTP) n&apos;est configuré : les e-mails ne partent pas, mais restent consultables ici. Voir le README pour la configuration.
        </Alert>
      )}
      {!rows.length ? (
        <EmptyState icon={<Mail className="size-8" />} title="Aucun e-mail pour le moment" />
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Disclosure
              key={m.id}
              summary={
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{m.subject}</span>
                  <span className="text-sm text-muted">→ {m.to}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                    {m.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}
                    {m.delivered ? <Badge tone="ok">Envoyé</Badge> : <Badge tone={m.error?.includes("mode test") ? "warn" : "danger"}>{m.error?.includes("mode test") ? "Non envoyé (test)" : "Échec"}</Badge>}
                  </span>
                </div>
              }
            >
              {m.error && !m.error.includes("mode test") && <Alert tone="danger" className="mb-4">{m.error}</Alert>}
              <iframe title={m.subject} srcDoc={m.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[520px] w-full rounded-xl border border-line bg-white" />
            </Disclosure>
          ))}
        </div>
      )}
    </>
  );
}
