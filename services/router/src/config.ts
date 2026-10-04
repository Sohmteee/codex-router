import { randomBytes } from "node:crypto";
import { z } from "zod";

const EnvironmentSchema = z.object({
  CODEX_ROUTER_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  CODEX_ROUTER_PORT: z.coerce.number().int().min(1024).max(65535).default(4187),
  CODEX_ROUTER_DATA_DIR: z.string().min(1).optional(),
  CODEX_ROUTER_LOCAL_TOKEN: z.string().min(32).optional(),
  CODEX_ROUTER_CODEX_BIN: z.string().min(1).default("codex"),
  CODEX_ROUTER_COMPATIBILITY_PASSED: z.enum(["true", "false"]).default("false"),
});

export type RouterConfig = z.infer<typeof EnvironmentSchema> & { localToken: string };

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RouterConfig {
  const parsed = EnvironmentSchema.parse(environment);
  return { ...parsed, localToken: parsed.CODEX_ROUTER_LOCAL_TOKEN ?? randomBytes(32).toString("base64url") };
}
