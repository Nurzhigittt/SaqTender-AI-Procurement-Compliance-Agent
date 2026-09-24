import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    title: locale === "ru" ? "SaqTender AI — Помощник по тендерам" : "SaqTender AI — Procurement Compliance Agent",
    description: locale === "ru"
      ? "Проверяйте требования тендера, документы компании и сроки в одном месте. Демонстрационная версия для тендерных специалистов Казахстана."
      : "Review tender requirements, company documents, and deadlines in one evidence-backed workspace. A fictional demonstration for Kazakhstan procurement teams.",
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return <html lang={locale}><body>{children}</body></html>;
}
