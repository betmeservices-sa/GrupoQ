import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Centro de Comunicación, Grupo Q",
  description:
    "Bandeja omnicanal interna de Grupo Q: WhatsApp, redes sociales y chat entre áreas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
