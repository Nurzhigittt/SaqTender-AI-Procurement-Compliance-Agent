import { AlertCircle, Check, CircleHelp, Clock3, X } from "lucide-react";
import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: string; dot?: boolean }) {
  return <span className={`badge badge-${tone}`}>{dot && <span className="badge-dot" />}{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; tone: string; icon: typeof Check }> = {
    met: { label: "Met", tone: "green", icon: Check },
    active: { label: "Active", tone: "green", icon: Check },
    missing: { label: "Missing", tone: "red", icon: X },
    at_risk: { label: "At risk", tone: "amber", icon: AlertCircle },
    unknown: { label: "Unknown", tone: "neutral", icon: CircleHelp },
    not_verified: { label: "Not verified", tone: "neutral", icon: CircleHelp },
    expired: { label: "Expired", tone: "red", icon: Clock3 },
  };
  const item = config[status] ?? config.unknown;
  const Icon = item.icon;
  return <Badge tone={item.tone}><Icon size={12} strokeWidth={2.4} />{item.label}</Badge>;
}

export function formatDate(value: string, withTime = false) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00+05:00` : value);
  if (Number.isNaN(date.getTime())) return "Date requires verification";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Almaty", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(date);
}
