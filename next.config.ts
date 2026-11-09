import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker légère (serveur autonome) pour l'hébergement sur la VM de la ville
  output: "standalone",
  // pdfkit lit ses polices sur le disque : il ne doit pas être empaqueté
  serverExternalPackages: ["pdfkit"],
  // pdfkit lit ses polices (.afm) à l'exécution : elles doivent être copiées avec le serveur
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/**"],
  },
  experimental: {
    // envoi des photos de mallettes depuis l'admin
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
