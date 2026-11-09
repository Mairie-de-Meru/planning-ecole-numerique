import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // envoi des photos de mallettes depuis l'admin
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
