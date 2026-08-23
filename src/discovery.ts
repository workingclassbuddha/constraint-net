import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ConstraintManifest } from "./types.js";

export function wellKnownActionsUrl(domain: string): string {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://${normalized}/.well-known/constraint-net/actions.json`;
}

export async function fetchManifestFromUrl(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<ConstraintManifest> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("manifest_discovery_requires_https");
  }

  if (!isLocalhost(parsed.hostname)) {
    const addresses = isIP(parsed.hostname)
      ? [parsed.hostname]
      : (await lookup(parsed.hostname, { all: true, verbatim: true })).map((entry) => entry.address);

    if (addresses.some(isPrivateOrLocalAddress)) {
      throw new Error("manifest_discovery_private_address_blocked");
    }
  }

  const response = await fetchImpl(url, {
    redirect: "manual",
    headers: { accept: "application/json" }
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("manifest_discovery_redirect_blocked");
  }

  if (!response.ok) {
    throw new Error(`manifest_fetch_failed:${response.status}`);
  }

  return (await response.json()) as ConstraintManifest;
}

export function publisherDomainFromManifestUrl(url: string): string | undefined {
  const parsed = new URL(url);
  if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") return undefined;
  return parsed.hostname;
}

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.replace(/\.$/, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isPrivateOrLocalAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0.0.0.0") return true;

  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a === 0
    );
  }

  if (isIP(normalized) === 6) {
    return normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }

  return false;
}
