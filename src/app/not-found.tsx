import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page introuvable</h1>
        <LinkButton href="/" className="mt-6">Retour au planning</LinkButton>
      </div>
    </main>
  );
}
