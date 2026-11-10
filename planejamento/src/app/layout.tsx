import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import MetaPixel from "@/components/MetaPixel";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

// Só o domínio (sem /planejamento): o Next já coloca o caminho nos endereços das imagens.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production" ? "https://www.uaucomunicacaodigital.com.br" : "http://localhost:3000");

const title = "Planejamento do Mês em 5 Minutos · UAU Digital";
const description = "O mês do seu cliente planejado em 5 minutos, com cada post com um motivo pra existir.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, type: "website", locale: "pt_BR", siteName: "UAU Digital" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#0F0E11",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={bricolage.variable}>
      <body>
        {children}
        <MetaPixel />
      </body>
    </html>
  );
}
