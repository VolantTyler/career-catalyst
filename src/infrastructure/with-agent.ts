import type { SDKAgent } from "@cursor/sdk";
import type { CatalystConfig } from "../config/env.js";
import {
  createConfiguredAgent,
  persistAgentMetadata,
  resumeConfiguredAgent,
} from "./agent-factory.js";
import { openCatalystStore, type CatalystStore } from "./persistence/store.js";

export interface RunWithAgentOptions {
  config: CatalystConfig;
  /** When set, resumes this agent instead of creating a new one. */
  resumeAgentId?: string;
}

export interface CareerCatalystAgentContext {
  agent: SDKAgent;
  resolvedModelId: string;
  store: CatalystStore;
}

/**
 * Creates (or resumes) an agent, yields it to the callback, then async-disposes.
 * Persists agent metadata on create; exposes the SQLite store for run logging.
 */
export async function withCareerCatalystAgent<T>(
  options: RunWithAgentOptions,
  fn: (ctx: CareerCatalystAgentContext) => Promise<T>
): Promise<T> {
  const store = openCatalystStore(options.config);

  try {
    if (options.resumeAgentId) {
      const agent = await resumeConfiguredAgent(
        options.config,
        store,
        options.resumeAgentId
      );
      const session = store.getSession(options.resumeAgentId);
      const resolvedModelId = session?.modelId ?? options.resumeAgentId;
      try {
        return await fn({ agent, resolvedModelId, store });
      } finally {
        await agent[Symbol.asyncDispose]();
      }
    }

    const { agent, resolvedModelId } = await createConfiguredAgent(
      options.config
    );
    persistAgentMetadata(store, options.config, agent, resolvedModelId);

    try {
      return await fn({ agent, resolvedModelId, store });
    } finally {
      await agent[Symbol.asyncDispose]();
    }
  } finally {
    store.close();
  }
}
