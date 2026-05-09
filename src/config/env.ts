import { config as loadDotenv } from "dotenv";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export type CatalystRuntime = "local" | "cloud";

export interface CatalystConfig {
  apiKey: string;
  /** Resolved default model id preference (before registry validation). */
  modelPreference: string;
  /** Use server-side default model selection on cloud (omit `model` on Agent options). */
  cloudAccountDefaultModel: boolean;
  runtime: CatalystRuntime;
  /** Working directory for local agents (default: process.cwd()). */
  cwd: string;
  dataDir: string;
  databasePath: string;
  /** Cloud only: GitHub repository URL. */
  cloudRepoUrl: string | undefined;
  cloudStartingRef: string;
  cloudAutoCreatePr: boolean;
  cloudSkipReviewerRequest: boolean;
  /** Optional display name for agents. */
  agentName: string;
}

let configCache: CatalystConfig | undefined;

/**
 * Load environment from `.env` in cwd, then parse Career Catalyst + Cursor SDK settings.
 * Call from every CLI entrypoint before using the SDK.
 */
export function loadConfig(cwd: string = process.cwd()): CatalystConfig {
  if (configCache) {
    return configCache;
  }

  loadDotenv({ path: resolve(cwd, ".env") });

  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing CURSOR_API_KEY. Set it in the environment or in a .env file in the project root."
    );
  }

  const dataDir = resolve(cwd, process.env.CAREER_CATALYST_DATA_DIR ?? "data");
  mkdirSync(dataDir, { recursive: true });

  const runtimeRaw = (process.env.CAREER_CATALYST_RUNTIME ?? "local").toLowerCase();
  if (runtimeRaw !== "local" && runtimeRaw !== "cloud") {
    throw new Error(
      `CAREER_CATALYST_RUNTIME must be "local" or "cloud" (got: ${runtimeRaw})`
    );
  }
  const runtime = runtimeRaw as CatalystRuntime;

  const cloudRepoUrl = process.env.CAREER_CATALYST_CLOUD_REPO_URL?.trim() || undefined;
  if (runtime === "cloud" && !cloudRepoUrl) {
    throw new Error(
      "CAREER_CATALYST_CLOUD_REPO_URL is required when CAREER_CATALYST_RUNTIME=cloud"
    );
  }

  const cloudAccountDefaultModel =
    process.env.CAREER_CATALYST_CLOUD_ACCOUNT_DEFAULT_MODEL === "1" ||
    process.env.CAREER_CATALYST_CLOUD_ACCOUNT_DEFAULT_MODEL === "true";

  configCache = {
    apiKey,
    modelPreference:
      process.env.CURSOR_MODEL?.trim() ||
      process.env.CAREER_CATALYST_MODEL?.trim() ||
      "composer-2",
    cloudAccountDefaultModel,
    runtime,
    cwd: resolve(cwd, process.env.CAREER_CATALYST_CWD?.trim() || "."),
    dataDir,
    databasePath: resolve(
      dataDir,
      process.env.CAREER_CATALYST_DB_NAME ?? "catalyst-sdk.sqlite"
    ),
    cloudRepoUrl,
    cloudStartingRef:
      process.env.CAREER_CATALYST_CLOUD_REF?.trim() || "main",
    cloudAutoCreatePr:
      process.env.CAREER_CATALYST_CLOUD_AUTO_PR === "true" ||
      process.env.CAREER_CATALYST_CLOUD_AUTO_PR === "1",
    cloudSkipReviewerRequest:
      process.env.CAREER_CATALYST_CLOUD_SKIP_REVIEWER !== "false",
    agentName:
      process.env.CAREER_CATALYST_AGENT_NAME?.trim() || "Career Catalyst",
  };

  return configCache;
}

export function resetConfigCacheForTests(): void {
  configCache = undefined;
}
