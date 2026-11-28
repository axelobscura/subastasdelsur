import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

// Variable in weight and width: normal width for text, condensed (font-display) for headlines.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Subastas del sur", template: "%s · Subastas del sur" },
  description: "Subastas en línea. Puja desde cualquier lugar: cada subasta empieza y termina en el mismo instante para todos.",
  openGraph: { siteName: "Subastas del sur", locale: "es_MX", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
