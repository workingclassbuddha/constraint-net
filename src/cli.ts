#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fetchManifestFromUrl } from "./discovery.js";
import { verifyReceiptChain } from "./receiptVerification.js";
import { validateManifest } from "./validator.js";

async function main(argv: string[]) {
  const [command, ...args] = argv;

  if (command === "validate") {
    const manifestPath = args[0];
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const result = validateManifest(manifest);
    if (!result.valid) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(`manifest valid: ${manifest.manifest_id}`);
    return;
  }

  if (command === "ingest-url") {
    const url = args[0];
    const server = valueAfter(args, "--server") ?? "http://127.0.0.1:4173";
    const response = await fetch(`${server}/v1/manifests/ingest-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    console.log(JSON.stringify(await response.json(), null, 2));
    process.exitCode = response.ok ? 0 : 1;
    return;
  }

  if (command === "plan") {
    const server = valueAfter(args, "--server") ?? "http://127.0.0.1:4173";
    const goal = valueAfter(args, "--goal") ?? "";
    const merchant = valueAfter(args, "--merchant");
    const response = await fetch(`${server}/v1/actions/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal,
        constraints: { merchant, risk_tiers_allowed: [0, 1, 2], requires_reversible: true }
      })
    });
    console.log(JSON.stringify(await response.json(), null, 2));
    process.exitCode = response.ok ? 0 : 1;
    return;
  }

  if (command === "verify-receipt") {
    const receiptPath = args[0];
    const payload = JSON.parse(await readFile(receiptPath, "utf8"));
    const receipts = Array.isArray(payload) ? payload : payload.receipts;
    const result = verifyReceiptChain(receipts);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
    return;
  }

  if (command === "fetch") {
    const manifest = await fetchManifestFromUrl(args[0]);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.error(
    "Usage: constraint-net validate <manifest.json> | ingest-url <url> [--server <url>] | plan --goal <goal> [--merchant <domain>] [--server <url>] | verify-receipt <receipt-chain.json>"
  );
  process.exitCode = 1;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

await main(process.argv.slice(2));
