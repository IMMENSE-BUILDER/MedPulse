import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomePage } from "@/components/welcome/WelcomePage";
import "./welcome.css";

const DESCRIPTION =
  "Compare Indian prescription medicines and lab tests four ways: the PMBJP government benchmark, subsidised generics matched by active salt, branded express pharmacies and diagnostic lab packages.";

export const metadata: Metadata = {
  title: "MedPulse AI — one search prices it four ways",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "MedPulse AI",
    url: "/",
    title: "MedPulse AI — one search prices it four ways",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Public front door. The price engine lives at /engine; every legacy
 * `/?q=&pin=&type=` share link is forwarded there so existing bookmarks and
 * shared comparisons keep working.
 */
export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  if (params.q || params.pin || params.type) {
    const forwarded = new URLSearchParams();
    for (const key of ["q", "pin", "type"] as const) {
      const value = params[key];
      const first = Array.isArray(value) ? value[0] : value;
      if (first) forwarded.set(key, first);
    }
    redirect(`/engine?${forwarded.toString()}`);
  }

  return <WelcomePage />;
}
