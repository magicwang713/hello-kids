import * as Localization from "expo-localization";

export function formatMinutesToH(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const parts = [] as string[];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function formatDateLabel(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(Localization.getLocales()[0]?.languageTag ?? "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function percent(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
