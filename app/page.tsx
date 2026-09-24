import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  const mode = !process.env.OPENAI_API_KEY?.trim() || process.env.DEMO_MODE?.trim().toLowerCase() === "true" ? "demo" : "live";
  return <Dashboard initialMode={mode} initialNow={new Date().toISOString()} />;
}
