export type CsvColumn = {
  key: string;
  title: string;
};

const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const JSON_MIME_TYPE = "application/json;charset=utf-8";
const UTF8_BOM = "\uFEFF";

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function stringifyValue(value: unknown, space?: number) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key: string, nestedValue: unknown) => {
      if (typeof nestedValue === "bigint") {
        return nestedValue.toString();
      }

      if (typeof nestedValue === "object" && nestedValue !== null) {
        if (seen.has(nestedValue)) {
          return "[Circular]";
        }
        seen.add(nestedValue);
      }

      return nestedValue;
    }, space) ?? "";
  } catch {
    return String(value);
  }
}

export function formatDateForFileName(date = new Date()): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
}

export function safeString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();

  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "object":
      return stringifyValue(value);
    case "symbol":
      return value.description ?? String(value);
    case "function":
      return value.name || "[Function]";
    case "undefined":
      return "";
    default:
      return String(value);
  }
}

function escapeCsvCell(value: unknown): string {
  const text = safeString(value);
  const escaped = text.replace(/"/g, "\"\"");
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((column) => escapeCsvCell(column.title)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(","),
  );

  return [header, ...body].join("\r\n");
}

export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): void {
  downloadTextFile(filename, `${UTF8_BOM}${toCsv(rows, columns)}`, CSV_MIME_TYPE);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, stringifyValue(data, 2), JSON_MIME_TYPE);
}
