import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteAmbient } from "@/components/SiteAmbient";
import "./globals.css";
import "./ambient.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://medpulse-ai-snowy.vercel.app"),
  title: "MedPulse AI — branded vs generic price engine",
  description:
    "Real-time dual-track price comparison: PMBJP/Jan Aushadhi generics vs branded e-pharmacies, on-demand live-agent stock checks, lab test comparison and prescription OCR.",
  applicationName: "MedPulse AI",
  openGraph: {
    type: "website",
    siteName: "MedPulse AI",
    url: "/",
    title: "MedPulse AI — branded vs generic price engine",
    description:
      "Real-time dual-track price comparison: PMBJP/Jan Aushadhi generics vs branded e-pharmacies, on-demand live-agent stock checks, lab test comparison and prescription OCR.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f4f6f5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("medpulse:theme")==="dark")document.documentElement.classList.remove("light");else document.documentElement.classList.add("light")}catch(e){document.documentElement.classList.add("light")}',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh font-sans text-ink antialiased">
        <SiteAmbient />
        {children}
      </body>
    </html>
  );
}
