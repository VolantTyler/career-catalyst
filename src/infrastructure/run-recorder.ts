import type { RunResult } from "@cursor/sdk";
import type { CatalystStore } from "./persistence/store.js";

const PREVIEW = 4000;

export function previewText(text: string, max = PREVIEW): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

export function recordRunResult(
  store: CatalystStore,
  input: {
    runId: string;
    agentId: string | null;
    result: RunResult;
    promptPreview: string;
  }
): void {
  store.recordRun({
    runId: input.runId,
    agentId: input.agentId,
    status: input.result.status,
    durationMs: input.result.durationMs ?? null,
    promptPreview: previewText(input.promptPreview, 2000),
    resultPreview: input.result.result
      ? previewText(input.result.result)
      : null,
  });
}
