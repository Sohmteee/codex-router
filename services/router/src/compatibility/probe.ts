import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable as NodeReadable, Writable } from "node:stream";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
type Check = "pass" | "blocked" | "not_run";
type RpcResult = Record<string, unknown>;

type CompatibilityReport = {
  generatedAt: string;
  codexCliVersion: string | null;
  desktopVersion: string | null;
  appServerVersion: string | null;
  checks: {
    accountContext: Check;
    catalogRead: Check;
    quotaRead: Check;
    usageRead: Check;
    inference: Check;
    streamingAndCancellation: Check;
    toolContinuation: Check;
    safeModelSwitch: Check;
    desktopRouting: Check;
  };
  evidence: {
    accountType: "chatgpt" | "apiKey" | "other" | null;
    accountIdentityPresent: boolean;
    discoveredModelCount: number | null;
    catalogContainsAtLeastTwoEntries: boolean | null;
    quotaWindowsAvailable: boolean | null;
    quotaAccountIdPresent: boolean;
    quotaReadAt: string | null;
    usageSummaryAvailable: boolean | null;
    usageReadAt: string | null;
    blockerCodes: string[];
  };
};

class AppServerClient {
  private readonly process: ChildProcessByStdio<Writable, NodeReadable, null>;
  private readonly lines: ReturnType<typeof createInterface>;
  private nextId = 0;
  private readonly pending = new Map<number, { resolve: (value: RpcResult) => void; reject: (error: Error) => void }>();

  constructor(binary: string) {
    this.process = spawn(binary, ["app-server", "--listen", "stdio://"], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    this.lines = createInterface({ input: this.process.stdout });
    this.lines.on("line", (line) => this.receive(line));
    this.process.on("error", () => this.rejectAll(new Error("app_server_unavailable")));
    this.process.on("exit", () => {
      this.lines.close();
      this.rejectAll(new Error("app_server_exited"));
    });
  }

  async request(method: string, params: unknown): Promise<RpcResult> {
    const id = ++this.nextId;
    let timeout: NodeJS.Timeout;
    const response = new Promise<RpcResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("app_server_timeout"));
      }, 20_000);
    });

    this.process.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    try {
      return await response;
    } finally {
      clearTimeout(timeout!);
    }
  }

  notify(method: string, params: unknown): void {
    this.process.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  close(): void {
    this.process.stdin.end();
    const timer = setTimeout(() => {
      this.process.kill();
      this.lines.close();
      this.process.stdout.destroy();
    }, 1_000);
    this.process.once("exit", () => clearTimeout(timer));
  }

  private receive(line: string): void {
    let message: { id?: number; result?: RpcResult; error?: { code?: number; message?: string } };
    try {
      message = JSON.parse(line) as typeof message;
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      const knownAuthBlock = /codex account authentication required/i.test(message.error.message ?? "");
      pending.reject(new Error(knownAuthBlock ? "codex_account_auth_required" : `app_server_rpc_${message.error.code ?? "error"}`));
    }
    else pending.resolve(message.result ?? {});
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

async function run(): Promise<void> {
  const binary = process.env["CODEX_ROUTER_CODEX_BIN"] ?? "codex";
  const report = emptyReport();
  const blockers = new Set<string>();

  try {
    const versionResult = await execFileAsync(binary, ["--version"], { windowsHide: true, timeout: 10_000 });
    report.codexCliVersion = versionResult.stdout.trim().slice(0, 120);
  } catch {
    blockers.add("codex_cli_unavailable");
  }

  report.desktopVersion = await findDesktopVersion();
  if (!report.desktopVersion) blockers.add("desktop_version_not_detected");

  const client = new AppServerClient(binary);
  try {
    const initialized = await client.request("initialize", {
      clientInfo: { name: "codex-router-compatibility-probe", title: "Codex Router Compatibility Probe", version: "0.1.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    client.notify("initialized", {});
    report.appServerVersion = findVersion(String(initialized["userAgent"] ?? ""));

    try {
      const account = await client.request("account/read", { refreshToken: false });
      const accountValue = asRecord(account["account"]);
      const accountType = accountValue?.["type"];
      report.evidence.accountType = accountType === "chatgpt" || accountType === "apiKey" ? accountType : accountType ? "other" : null;
      report.evidence.accountIdentityPresent = accountType === "chatgpt";
      report.checks.accountContext = report.evidence.accountIdentityPresent ? "pass" : "blocked";
      if (!report.evidence.accountIdentityPresent) blockers.add(accountType ? "codex_cli_account_type_not_chatgpt" : "codex_cli_account_not_signed_in");
    } catch (error) {
      report.checks.accountContext = "blocked";
      blockers.add(safeBlocker("account_read", error));
    }

    try {
      const models = await client.request("model/list", { limit: 100, includeHidden: false });
      const data = Array.isArray(models["data"]) ? models["data"] : [];
      report.evidence.discoveredModelCount = data.length;
      report.evidence.catalogContainsAtLeastTwoEntries = data.length >= 2;
      report.checks.catalogRead = data.length > 0 ? "pass" : "blocked";
    } catch (error) {
      report.checks.catalogRead = "blocked";
      blockers.add(safeBlocker("model_catalog", error));
    }

    try {
      const readAt = new Date().toISOString();
      const limits = await client.request("account/rateLimits/read", { excludeResetCreditDetails: true });
      const byLimit = asRecord(limits["rateLimitsByLimitId"]);
      const snapshots = byLimit ? Object.values(byLimit) : [];
      if (snapshots.length === 0) snapshots.push(limits["rateLimits"]);
      const hasWindows = snapshots.some((snapshot) => {
        const record = asRecord(snapshot);
        return Boolean(record?.["primary"] || record?.["secondary"]);
      });
      report.evidence.quotaWindowsAvailable = hasWindows;
      report.evidence.quotaAccountIdPresent = typeof limits["accountId"] === "string" && limits["accountId"].length > 0;
      report.evidence.quotaReadAt = readAt;
      report.checks.quotaRead = hasWindows ? "pass" : "blocked";
      if (!hasWindows) blockers.add("quota_windows_unavailable");
    } catch (error) {
      report.checks.quotaRead = "blocked";
      blockers.add(safeBlocker("quota_read", error));
    }

    try {
      const readAt = new Date().toISOString();
      const usage = await client.request("account/usage/read", {});
      report.evidence.usageSummaryAvailable = typeof usage["summary"] === "object" && usage["summary"] !== null;
      report.evidence.usageReadAt = readAt;
      report.checks.usageRead = report.evidence.usageSummaryAvailable ? "pass" : "blocked";
      if (!report.evidence.usageSummaryAvailable) blockers.add("usage_summary_unavailable");
    } catch (error) {
      report.checks.usageRead = "blocked";
      blockers.add(safeBlocker("usage_read", error));
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "app_server_initialize_failed";
    blockers.add(code.startsWith("app_server_") ? code : "app_server_initialize_failed");
  } finally {
    client.close();
  }

  report.evidence.blockerCodes = [...blockers].sort();
  const output = path.join(process.cwd(), ".cache", "compatibility", "latest.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function emptyReport(): CompatibilityReport {
  return {
    generatedAt: new Date().toISOString(),
    codexCliVersion: null,
    desktopVersion: null,
    appServerVersion: null,
    checks: {
      accountContext: "not_run",
      catalogRead: "not_run",
      quotaRead: "not_run",
      usageRead: "not_run",
      inference: "not_run",
      streamingAndCancellation: "not_run",
      toolContinuation: "not_run",
      safeModelSwitch: "not_run",
      desktopRouting: "not_run",
    },
    evidence: {
      accountType: null,
      accountIdentityPresent: false,
      discoveredModelCount: null,
      catalogContainsAtLeastTwoEntries: null,
      quotaWindowsAvailable: null,
      quotaAccountIdPresent: false,
      quotaReadAt: null,
      usageSummaryAvailable: null,
      usageReadAt: null,
      blockerCodes: [],
    },
  };
}

async function findDesktopVersion(): Promise<string | null> {
  const desktopVersion = process.env["CODEX_ROUTER_DESKTOP_VERSION"];
  if (desktopVersion) return desktopVersion.slice(0, 120);
  if (process.platform !== "win32") return null;
  try {
    const command = "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); Get-ItemProperty $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '^Codex( Desktop)?$' } | Select-Object -First 1 -ExpandProperty DisplayVersion";
    const result = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 8_000 });
    return result.stdout.trim().slice(0, 120) || null;
  } catch {
    return null;
  }
}

function findVersion(userAgent: string): string | null {
  const match = userAgent.match(/(?:Codex Desktop|codex-cli)\/([^\s;]+)/i);
  return match?.[1] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeBlocker(prefix: string, error: unknown): string {
  if (!(error instanceof Error)) return `${prefix}_failed`;
  if (error.message === "codex_account_auth_required") return "codex_cli_account_not_signed_in";
  const rpcCode = error.message.match(/^app_server_rpc_(-?\d+)$/)?.[1];
  if (rpcCode) return `${prefix}_rpc_${rpcCode}`;
  if (/^app_server_[a-z_]+$/.test(error.message)) return `${prefix}_${error.message.slice("app_server_".length)}`;
  return `${prefix}_failed`;
}

void run().catch(() => {
  process.stderr.write("Compatibility probe failed. Raw app-server output was suppressed.\n");
  process.exitCode = 1;
});
