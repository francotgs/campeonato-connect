import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campeonato MundIAl 4Match",
  description: "Torneo relámpago de cartas de fútbol en vivo — Evento Connect de Grupo CEDI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d1117",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[#0d1117] text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
