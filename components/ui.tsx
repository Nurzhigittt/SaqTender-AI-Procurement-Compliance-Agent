import { AlertCircle, Check, CircleHelp, Clock3, X } from "lucide-react";
import type { ReactNode } from "react";
import { translate, type Locale } from "@/lib/i18n";

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: string; dot?: boolean }) {
  return <span className={`badge badge-${tone}`}>{dot && <span className="badge-dot" />}{children}</span>;
}

export function StatusBadge({ status, locale = "en" }: { status: string; locale?: Locale }) {
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const config: Record<string, { label: string; tone: string; icon: typeof Check }> = {
    met: { label: tx("Met", "Выполнено"), tone: "green", icon: Check },
    active: { label: tx("Active", "Действует"), tone: "green", icon: Check },
    missing: { label: tx("Missing", "Отсутствует"), tone: "red", icon: X },
    at_risk: { label: tx("At risk", "Есть риск"), tone: "amber", icon: AlertCircle },
    unknown: { label: tx("Unknown", "Нет данных"), tone: "neutral", icon: CircleHelp },
    not_verified: { label: tx("Not verified", "Не проверено"), tone: "neutral", icon: CircleHelp },
    expired: { label: tx("Expired", "Срок истёк"), tone: "red", icon: Clock3 },
  };
  const item = config[status] ?? config.unknown;
  const Icon = item.icon;
  return <Badge tone={item.tone}><Icon size={12} strokeWidth={2.4} />{item.label}</Badge>;
}

export function formatDate(value: string, withTime = false, locale: Locale = "en") {
  const date = new Date(value.length === 10 ? `${value}T00:00:00+05:00` : value);
  if (Number.isNaN(date.getTime())) return translate(locale, "Date requires verification", "Дату нужно проверить");
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Almaty", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(date);
}
