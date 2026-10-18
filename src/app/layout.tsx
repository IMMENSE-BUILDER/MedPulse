import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("medpulse:theme")==="light")document.documentElement.classList.add("light")}catch(e){}',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
