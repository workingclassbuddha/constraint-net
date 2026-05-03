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

  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json"
    }
  });

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
