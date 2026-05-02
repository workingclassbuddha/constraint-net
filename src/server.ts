import { buildServer } from "./app.js";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildServer();

await app.listen({ port, host });

console.log(`Constraint Net dev server listening at http://${host}:${port}`);
