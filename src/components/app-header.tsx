import Link from "next/link";
import { LogOut } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { testMode } from "@/lib/mail";
import { logoutAction } from "@/app/actions";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function AppHeader({ user, appName, section }: { user: CurrentUser; appName: string; section: "school" | "admin" }) {
  const links =
    section === "admin"
      ? [
          { href: "/admin", label: "Planning" },
          { href: "/admin/livraisons", label: "Livraisons" },
          { href: "/admin/valises", label: "Valises" },
          { href: "/admin/periodes", label: "Périodes" },
          { href: "/admin/ecoles", label: "Écoles" },
          { href: "/admin/emails", label: "E-mails" },
          { href: "/admin/reglages", label: "Réglages" },
        ]
      : [
          { href: "/", label: "Planning" },
          { href: "/reservations", label: "Mes réservations" },
          { href: "/mon-ecole", label: "Mon école" },
        ];
  return (
    <>
      {testMode() && (
        <div className="no-print bg-warn-soft px-4 py-1.5 text-center text-xs font-semibold text-warn">
          Mode test : les e-mails ne sont pas envoyés, les liens s&apos;affichent à l&apos;écran.
        </div>
      )}
      <header className="no-print sticky top-0 z-20 border-b-2 border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-8 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href={section === "admin" ? "/admin" : "/"} className="shrink-0">
              <Brand name={appName} />
            </Link>
            <div className="flex items-center gap-1 sm:hidden">
              <UserMenu user={user} section={section} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <NavLinks links={links} />
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <UserMenu user={user} section={section} />
          </div>
        </div>
      </header>
    </>
  );
}

function UserMenu({ user, section }: { user: CurrentUser; section: "school" | "admin" }) {
  return (
    <>
      {user.admin && (
        <Link
          href={section === "admin" ? "/" : "/admin"}
          className="rounded-lg px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent-soft"
        >
          {section === "admin" ? "Vue école" : "Administration"}
        </Link>
      )}
      <form action={logoutAction}>
        <button
          type="submit"
          title={`Déconnexion (${user.email})`}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="size-4" />
          <span className="sr-only">Déconnexion</span>
        </button>
      </form>
    </>
  );
}
