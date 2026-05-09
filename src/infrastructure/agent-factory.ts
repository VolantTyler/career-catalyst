import { Agent, type AgentOptions, type SDKAgent } from "@cursor/sdk";
import type { CatalystConfig } from "../config/env.js";
import { resolveModelSelection } from "./model-registry.js";
import type { CatalystStore } from "./persistence/store.js";

export interface ResolvedAgentCreation {
  options: AgentOptions;
  /** Model id after registry validation (always concrete, never omitted). */
  resolvedModelId: string;
}

/**
 * Build fully validated `AgentOptions` for both `Agent.create` / `Agent.prompt`.
 */
export async function resolveAgentCreation(
  config: CatalystConfig
): Promise<ResolvedAgentCreation> {
  const resolved = await resolveModelSelection(
    config.apiKey,
    config.modelPreference
  );

  const modelBlock: AgentOptions["model"] =
    config.runtime === "cloud" && config.cloudAccountDefaultModel
      ? undefined
      : resolved;

  const options: AgentOptions = {
    apiKey: config.apiKey,
    name: config.agentName,
    model: modelBlock,
    ...(config.runtime === "local"
      ? { local: { cwd: config.cwd, settingSources: [] } }
      : {}),
    ...(config.runtime === "cloud" && config.cloudRepoUrl
      ? {
          cloud: {
            repos: [
              {
                url: config.cloudRepoUrl,
                startingRef: config.cloudStartingRef,
              },
            ],
            autoCreatePR: config.cloudAutoCreatePr,
            skipReviewerRequest: config.cloudSkipReviewerRequest,
          },
        }
      : {}),
  };

  return {
    options,
    resolvedModelId: resolved.id,
  };
}

/**
 * Create a new Cursor SDK agent using Career Catalyst config (explicit local **or** cloud).
 */
export async function createConfiguredAgent(
  config: CatalystConfig
): Promise<{ agent: SDKAgent; resolvedModelId: string }> {
  const { options, resolvedModelId } = await resolveAgentCreation(config);
  const agent = await Agent.create(options);
  return { agent, resolvedModelId };
}

/**
 * Record agent metadata immediately after creation (call once per agent).
 */
export function persistAgentMetadata(
  store: CatalystStore,
  config: CatalystConfig,
  agent: SDKAgent,
  resolvedModelId: string
): void {
  store.recordAgentSession({
    agentId: agent.agentId,
    runtime: config.runtime,
    modelId: resolvedModelId,
    localCwd: config.runtime === "local" ? config.cwd : null,
    cloudRepoUrl: config.runtime === "cloud" ? config.cloudRepoUrl ?? null : null,
    cloudStartingRef:
      config.runtime === "cloud" ? config.cloudStartingRef : null,
  });
}

/**
 * Resume an agent previously recorded in persistence (same runtime options must apply).
 */
export async function resumeConfiguredAgent(
  config: CatalystConfig,
  store: CatalystStore,
  agentId: string
): Promise<SDKAgent> {
  const session = store.getSession(agentId);
  if (!session) {
    throw new Error(
      `No persisted session for agent ${agentId}. Run a script that calls createConfiguredAgent + persistAgentMetadata first.`
    );
  }
  if (session.runtime !== config.runtime) {
    throw new Error(
      `Session runtime mismatch: stored=${session.runtime}, config=${config.runtime}`
    );
  }

  const modelSelection =
    session.runtime === "cloud" && config.cloudAccountDefaultModel
      ? undefined
      : { id: session.modelId };

  return Agent.resume(agentId, {
    apiKey: config.apiKey,
    name: config.agentName,
    model: modelSelection,
    local:
      session.runtime === "local" && session.localCwd
        ? { cwd: session.localCwd, settingSources: [] }
        : undefined,
    cloud:
      session.runtime === "cloud" && session.cloudRepoUrl
        ? {
            repos: [
              {
                url: session.cloudRepoUrl,
                startingRef: session.cloudStartingRef ?? "main",
              },
            ],
            autoCreatePR: config.cloudAutoCreatePr,
            skipReviewerRequest: config.cloudSkipReviewerRequest,
          }
        : undefined,
  });
}
