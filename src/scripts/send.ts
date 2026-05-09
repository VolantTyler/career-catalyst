/**
 * Multi-turn agent: create or resume, stream one message, persist run outcome.
 * Resume: CAREER_CATALYST_RESUME_AGENT=<agentId>
 */
import { CursorAgentError } from "@cursor/sdk";
import { loadConfig } from "../config/env.js";
import { recordRunResult } from "../infrastructure/run-recorder.js";
import { withCareerCatalystAgent } from "../infrastructure/with-agent.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const prompt =
    process.argv.slice(2).join(" ").trim() ||
    "Summarize this repository's purpose in one short paragraph.";

  const resumeId = process.env.CAREER_CATALYST_RESUME_AGENT?.trim();

  try {
    await withCareerCatalystAgent(
      { config, resumeAgentId: resumeId },
      async ({ agent, store }) => {
        console.log(`agent id: ${agent.agentId}`);

        const run = await agent.send(prompt);
        console.log(`run id: ${run.id}`);

        for await (const event of run.stream()) {
          if (event.type === "assistant") {
            for (const block of event.message.content) {
              if (block.type === "text") {
                process.stdout.write(block.text);
              }
            }
          }
        }

        const result = await run.wait();
        console.log(`\n\nstatus: ${result.status}`);

        recordRunResult(store, {
          runId: result.id,
          agentId: agent.agentId,
          result,
          promptPreview: prompt,
        });

        if (result.status === "error") {
          process.exitCode = 2;
        }
      }
    );
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`Startup / SDK error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
