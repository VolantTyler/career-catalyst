/**
 * One-shot `Agent.prompt` with resolved model + runtime options and SQLite run logging.
 */
import { Agent, CursorAgentError } from "@cursor/sdk";
import { loadConfig } from "../config/env.js";
import { resolveAgentCreation } from "../infrastructure/agent-factory.js";
import { openCatalystStore } from "../infrastructure/persistence/store.js";
import { recordRunResult } from "../infrastructure/run-recorder.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const prompt =
    process.argv.slice(2).join(" ").trim() ||
    "Reply with one sentence confirming the Cursor Agents SDK is configured for Career Catalyst.";

  const { options } = await resolveAgentCreation(config);
  const store = openCatalystStore(config);

  try {
    try {
      const result = await Agent.prompt(prompt, options);
      console.log(`\nrun id: ${result.id}`);
      console.log(`status: ${result.status}`);
      if (result.durationMs != null) {
        console.log(`durationMs: ${result.durationMs}`);
      }
      if (result.result) {
        console.log(`\n--- result ---\n${result.result}`);
      }

      recordRunResult(store, {
        runId: result.id,
        agentId: null,
        result,
        promptPreview: prompt,
      });

      if (result.status === "error") {
        process.exit(2);
      }
    } catch (err) {
      if (err instanceof CursorAgentError) {
        console.error(`Startup / SDK error: ${err.message}`);
        console.error(`retryable: ${err.isRetryable}`);
        process.exit(1);
      }
      throw err;
    }
  } finally {
    store.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
