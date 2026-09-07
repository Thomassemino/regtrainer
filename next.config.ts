import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Túneles de desarrollo para recibir webhooks de Mercado Pago y acceso externo.
  allowedDevOrigins: ["*.lhr.life", "*.serveousercontent.com", "*.serveo.net"],
};

export default nextConfig;
