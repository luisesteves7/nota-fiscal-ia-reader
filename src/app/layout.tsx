import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nota Fiscal IA Reader",
  description: "Leitor de notas fiscais com IA — upload, extração e histórico.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
