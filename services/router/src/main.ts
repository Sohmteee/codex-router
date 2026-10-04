import path from "node:path";
import { homedir } from "node:os";
import { createApi } from "./api.js";
import { loadConfig } from "./config.js";
import { RouterDatabase } from "./storage/database.js";

const config = loadConfig();
const dataDirectory = config.CODEX_ROUTER_DATA_DIR ?? path.join(homedir(), "AppData", "Local", "CodexRouter");
const database = new RouterDatabase(path.join(dataDirectory, "router.db"));
const app = createApi(config, database);

await app.listen({ host: config.CODEX_ROUTER_HOST, port: config.CODEX_ROUTER_PORT });
app.log.info("Codex Router control service started on loopback.");

let closing = false;
async function close(signal: NodeJS.Signals) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "Codex Router is stopping.");
  await app.close();
  database.close();
  process.exitCode = 0;
}

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));
