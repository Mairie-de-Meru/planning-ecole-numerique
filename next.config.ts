import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lit ses polices sur le disque : il ne doit pas être empaqueté
  serverExternalPackages: ["pdfkit"],
  experimental: {
    // envoi des photos de mallettes depuis l'admin
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
