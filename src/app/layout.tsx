import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource/caveat/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mallettes pédagogiques", template: "%s · Mallettes pédagogiques" },
  description: "Réservation de mallettes pédagogiques pour les écoles",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#12151f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
