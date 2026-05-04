import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("public launch readiness", () => {
  it("includes the public repo files developers expect before adoption", () => {
    expect(existsSync("LICENSE")).toBe(true);
    expect(existsSync("SECURITY.md")).toBe(true);
    expect(existsSync("CONTRIBUTING.md")).toBe(true);
    expect(existsSync("docs/launch-checklist.md")).toBe(true);
    expect(existsSync(".github/pull_request_template.md")).toBe(true);
  });

  it("states the alpha safety boundary in the package metadata and README", () => {
    const pkg = JSON.parse(read("package.json"));
    const readme = read("README.md");

    expect(pkg.name).toBe("constraint-net");
    expect(pkg.license).toBe("Apache-2.0");
    expect(pkg.description).toContain("agent-safe");
    expect(pkg.repository.url).toContain("workingclassbuddha/constraint-net");
    expect(readme).toContain("Public Alpha");
    expect(readme).toContain("internet for agents");
    expect(readme).toContain("not production key custody");
    expect(readme).toContain("mock OpenAPI-backed execution");
  });

  it("keeps public CI and development signing keys explicit", () => {
    const workflow = read(".github/workflows/ci.yml");
    const keys = read("src/keys.ts");

    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");
    expect(keys).toContain("public development issuer");
    expect(keys).toContain("Do not use");
  });
});
