/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permitimos que Next compile los paquetes del workspace sin pre-build.
  transpilePackages: ["@campeonato/domain", "@campeonato/cards"],
};

export default nextConfig;
