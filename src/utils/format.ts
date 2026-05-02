import dayjs from "dayjs";

const ONLINE_WINDOW_MILLIS = 5 * 60 * 1000;
const LOST_CONTACT_WINDOW_MILLIS = 7 * 24 * 60 * 60 * 1000;

export function fmtEpoch(value?: number | null) {
  if (!value || Number.isNaN(value)) return "-";
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

export function fmtRelativeFromNow(value?: number | null) {
  if (!value || Number.isNaN(value)) return "unknown";

  const diff = Date.now() - value;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";

  if (abs < 1_000) return diff >= 0 ? "just now" : "in <1s";
  if (abs < 60_000) return `${Math.floor(abs / 1_000)}s ${suffix}`;
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ${suffix}`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ${suffix}`;
  return `${Math.floor(abs / 86_400_000)}d ${suffix}`;
}

export function fmtDurationMs(value?: number | null) {
  if (!value || Number.isNaN(value) || value <= 0) return "0s";

  const totalSeconds = Math.floor(value / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function fmtBytes(value?: number | null) {
  if (value == null || Number.isNaN(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = -1;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function onlineStateFromLastSeen(lastSeenAtEpochMillis?: number | null): "online" | "offline" | "lost_contact" | "unknown" {
  if (!lastSeenAtEpochMillis || Number.isNaN(lastSeenAtEpochMillis)) return "unknown";
  const age = Date.now() - lastSeenAtEpochMillis;
  if (age <= ONLINE_WINDOW_MILLIS) return "online";
  if (age > LOST_CONTACT_WINDOW_MILLIS) return "lost_contact";
  return "offline";
}

export function isLostContactFromLastSeen(lastSeenAtEpochMillis?: number | null): boolean {
  return onlineStateFromLastSeen(lastSeenAtEpochMillis) === "lost_contact";
}

export function policyStatusColor(status?: string | null) {
  switch (String(status ?? "").toUpperCase()) {
    case "SUCCESS":
      return "green";
    case "FAILED":
      return "red";
    case "PENDING":
      return "gold";
    case "PARTIAL":
      return "orange";
    default:
      return "default";
  }
}

export function commandStatusColor(status?: string | null) {
  switch (String(status ?? "").toUpperCase()) {
    case "PENDING":
      return "gold";
    case "SENT":
      return "blue";
    case "SUCCESS":
      return "green";
    case "FAILED":
      return "red";
    case "CANCELLED":
      return "orange";
    case "EXPIRED":
      return "purple";
    default:
      return "default";
  }
}

export function telemetryFreshnessColor(value?: string | null) {
  switch (String(value ?? "").toUpperCase()) {
    case "FRESH":
      return "green";
    case "STALE":
      return "orange";
    default:
      return "default";
  }
}

export function tryFormatJsonString(value?: string | null) {
  if (!value) return "-";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function normalizeError(error: unknown, fallback = "Request failed"): string {
  const anyError = error as any;
  const body = anyError?.response?.data ?? {};
  const message = body.error ?? body.message ?? anyError?.message ?? fallback;
  const code = body.code ? ` [${body.code}]` : "";
  return `${message}${code}`;
}
