import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function sha256(value: unknown): string {
  const input = typeof value === "string" ? value : stableStringify(value);
  return `sha256-${createHash("sha256").update(input).digest("hex")}`;
}

export function publicId(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16)}`;
}
