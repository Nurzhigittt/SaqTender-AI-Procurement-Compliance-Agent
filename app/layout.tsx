import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaqTender AI — Procurement Compliance Agent",
  description: "Review tender requirements, company documents, and deadlines in one evidence-backed workspace. A fictional demonstration for Kazakhstan procurement teams.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
