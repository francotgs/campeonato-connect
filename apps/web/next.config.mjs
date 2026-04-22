import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permitimos que Next compile los paquetes del workspace sin pre-build.
  transpilePackages: ["@campeonato/domain", "@campeonato/cards"],
  // Para producción: genera un bundle standalone que Railway/Docker pueden correr sin node_modules.
  output: "standalone",
  // En un monorepo pnpm, Next necesita saber la raíz del monorepo para el file tracing.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  productionBrowserSourceMaps: false,
};

export default nextConfig;
