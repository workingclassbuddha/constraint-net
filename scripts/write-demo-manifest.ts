import { writeFileSync } from "node:fs";
import { soundmartManifest } from "../src/examples/soundmartManifest.js";

// Development only. Produces a freshly signed sample manifest for CLI and demo use.
// The signing key is intentionally public and must never be trusted in production.
writeFileSync("examples/soundmart/actions.json", JSON.stringify(soundmartManifest, null, 2) + "\n");
console.log("Regenerated short-lived signed SoundMart demo manifest");
