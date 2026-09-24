import { cookies } from "next/headers";
import { Dashboard } from "@/components/dashboard";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home() {
  const mode = !process.env.OPENAI_API_KEY?.trim() || process.env.DEMO_MODE?.trim().toLowerCase() === "true" ? "demo" : "live";
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return <Dashboard initialMode={mode} initialNow={new Date().toISOString()} initialLocale={locale} />;
}
