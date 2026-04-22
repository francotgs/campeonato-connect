import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campeonato MundIAl 4Match",
  description: "Torneo relámpago de cartas de fútbol en vivo — Evento Connect de Grupo CEDI.",
  applicationName: "Campeonato MundIAl 4Match",
  openGraph: {
    title: "Campeonato MundIAl 4Match",
    description: "Torneo relámpago de cartas de fútbol en vivo.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1020",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
