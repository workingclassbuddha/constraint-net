import Fastify from "fastify";
import { renderDemoPage } from "./demoPage.js";
import { soundmartManifest } from "./examples/soundmartManifest.js";
import { createMemoryStore, type MemoryStore } from "./memoryStore.js";
import { planCoherentPath } from "./planner.js";
import { decideConfirmation, executePreflight, preflightAction } from "./runtime.js";

export type BuildServerOptions = {
  store?: MemoryStore;
};

export function buildServer(options: BuildServerOptions = {}) {
  const store = options.store ?? createDefaultStore();
  const app = Fastify({ logger: false });

  app.get("/", async (_request, reply) => reply.type("text/html").send(renderDemoPage()));

  app.get("/v1/health", async () => ({
    name: "Constraint Net",
    status: "ok",
    thesis: "Resolve agent action paths by coherence under constraints."
  }));

  app.post<{
    Body: Parameters<typeof planCoherentPath>[1];
  }>("/v1/actions/search", async (request) => {
    const path = planCoherentPath(store, request.body);
    return {
      query_id: "qry_demo",
      paths: [
        {
          path_id: path.path_id,
          status: path.status,
          coherence_score: path.coherence_score,
          steps: path.steps.map((step) => step.stable_id),
          step_details: path.steps,
          why_coherent: path.why_coherent
        }
      ]
    };
  });

  app.post<{
    Body: Parameters<typeof preflightAction>[1];
  }>("/v1/executions/preflight", async (request, reply) => {
    const result = preflightAction(store, request.body);
    if (result.status === "action_not_found") return reply.code(404).send(result);
    if (result.status === "manifest_digest_mismatch" || result.status === "input_schema_invalid") {
      return reply.code(400).send(result);
    }
    return result;
  });

  app.post<{
    Params: { id: string };
    Body: { decision: "confirm" | "deny" };
  }>("/v1/confirmations/:id/decision", async (request, reply) => {
    const confirmation = decideConfirmation(store, request.params.id, request.body.decision);
    if (!confirmation) return reply.code(404).send({ status: "confirmation_not_found" });
    return confirmation;
  });

  app.post<{
    Body: Parameters<typeof executePreflight>[1];
  }>("/v1/executions", async (request, reply) => {
    const result = executePreflight(store, request.body);
    if (result.status !== "succeeded") return reply.code(400).send(result);
    return result;
  });

  app.get<{
    Params: { id: string };
  }>("/v1/receipts/:id", async (request, reply) => {
    const receipt = store.getReceipt(request.params.id);
    if (!receipt) return reply.code(404).send({ status: "receipt_not_found" });
    return receipt;
  });

  return app;
}

function createDefaultStore(): MemoryStore {
  const store = createMemoryStore();
  store.ingestManifest(soundmartManifest);
  return store;
}
