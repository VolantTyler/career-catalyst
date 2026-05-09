import { DatabaseSync } from "node:sqlite";
import type { CatalystConfig } from "../../config/env.js";

export type CatalystRuntime = "local" | "cloud";

export interface CatalystStore {
  readonly db: DatabaseSync;
  recordAgentSession(input: {
    agentId: string;
    runtime: CatalystRuntime;
    modelId: string;
    localCwd: string | null;
    cloudRepoUrl: string | null;
    cloudStartingRef: string | null;
  }): void;
  recordRun(input: {
    runId: string;
    agentId: string | null;
    status: string;
    durationMs: number | null;
    promptPreview: string;
    resultPreview: string | null;
  }): void;
  getSession(agentId: string):
    | {
        agentId: string;
        runtime: CatalystRuntime;
        modelId: string;
        localCwd: string | null;
        cloudRepoUrl: string | null;
        cloudStartingRef: string | null;
      }
    | undefined;
  close(): void;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sdk_agent_sessions (
      agent_id TEXT PRIMARY KEY,
      runtime TEXT NOT NULL,
      model_id TEXT NOT NULL,
      local_cwd TEXT,
      cloud_repo_url TEXT,
      cloud_starting_ref TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sdk_runs (
      run_id TEXT PRIMARY KEY,
      agent_id TEXT,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      prompt_preview TEXT NOT NULL,
      result_preview TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sdk_runs_agent ON sdk_runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sdk_runs_created ON sdk_runs(created_at);
  `);
}

export function openCatalystStore(config: CatalystConfig): CatalystStore {
  const db = new DatabaseSync(config.databasePath);
  migrate(db);

  const insertSession = db.prepare(`
    INSERT INTO sdk_agent_sessions (
      agent_id, runtime, model_id, local_cwd, cloud_repo_url, cloud_starting_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      model_id = excluded.model_id,
      local_cwd = excluded.local_cwd,
      cloud_repo_url = excluded.cloud_repo_url,
      cloud_starting_ref = excluded.cloud_starting_ref,
      updated_at = excluded.updated_at
  `);

  const insertRun = db.prepare(`
    INSERT INTO sdk_runs (run_id, agent_id, status, duration_ms, prompt_preview, result_preview, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const selectSession = db.prepare(`
    SELECT agent_id, runtime, model_id, local_cwd, cloud_repo_url, cloud_starting_ref
    FROM sdk_agent_sessions WHERE agent_id = ?
  `);

  return {
    db,
    recordAgentSession(input) {
      const now = Math.floor(Date.now() / 1000);
      insertSession.run(
        input.agentId,
        input.runtime,
        input.modelId,
        input.localCwd,
        input.cloudRepoUrl,
        input.cloudStartingRef,
        now,
        now
      );
    },
    recordRun(input) {
      const now = Math.floor(Date.now() / 1000);
      insertRun.run(
        input.runId,
        input.agentId,
        input.status,
        input.durationMs,
        input.promptPreview,
        input.resultPreview,
        now
      );
    },
    getSession(agentId) {
      const row = selectSession.get(agentId) as
        | {
            agent_id: string;
            runtime: string;
            model_id: string;
            local_cwd: string | null;
            cloud_repo_url: string | null;
            cloud_starting_ref: string | null;
          }
        | undefined;
      if (!row) {
        return undefined;
      }
      if (row.runtime !== "local" && row.runtime !== "cloud") {
        return undefined;
      }
      return {
        agentId: row.agent_id,
        runtime: row.runtime,
        modelId: row.model_id,
        localCwd: row.local_cwd,
        cloudRepoUrl: row.cloud_repo_url,
        cloudStartingRef: row.cloud_starting_ref,
      };
    },
    close() {
      db.close();
    },
  };
}
