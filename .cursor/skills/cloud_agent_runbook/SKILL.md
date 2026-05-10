---
name: cloud_agent_runbook
description: >-
  Run, configure, and smoke-test the Career Catalyst TypeScript CLI on Cursor Cloud.
  Use when bootstrapping an agent sandbox, verifying CURSOR_API_KEY and SDK scripts,
  toggling local vs cloud runtime via env, or isolating SQLite data during experiments.
---

# Career Catalyst — Cloud agent runbook

## What this repo is

Career Catalyst is a **CLI-only** TypeScript project: npm scripts call `@cursor/sdk` against the Cursor Cloud Agents API. There is **no HTTP server**, **no Docker compose**, and **no automated unit/integration test runner** — verification is **`npm run typecheck`** plus **manual SDK smoke tests**.

---

## First-time setup (any environment)

1. **Node.js ≥ 22** (required for `node:sqlite`).
2. From the repo root: `npm install` (native deps compile via the SDK toolchain).
3. **Authentication:** there is no interactive “login”. Set **`CURSOR_API_KEY`** in the environment **or** in a root `.env` file (copy `.env.example`). Obtain the key from the Cursor dashboard (Cloud Agents).
4. Optional: confirm key + list models — `npm run sdk:whoami`.

---

## Commands reference

| Goal | Command |
|------|---------|
| Install | `npm install` |
| Static analysis (“lint”) | `npm run typecheck` |
| Compile | `npm run build` |
| Verify API key + models + config summary | `npm run sdk:whoami` |
| One-shot agent (`Agent.prompt`) | `npm run sdk:prompt -- <prompt text>` |
| Multi-turn agent (`create` / `resume` + stream) | `npm run sdk:send -- <prompt text>` |

---

## Environment toggles (“feature flags”)

There is **no separate feature-flag service**. Behavior is controlled by **environment variables** documented in `.env.example` and parsed in `src/config/env.ts`.

| Variable | Role |
|----------|------|
| `CURSOR_API_KEY` | **Required.** API authentication. |
| `CURSOR_MODEL` / `CAREER_CATALYST_MODEL` | Preferred model id; validated against `Cursor.models.list()` with fallbacks. |
| `CAREER_CATALYST_RUNTIME` | `local` (default) or `cloud`. |
| `CAREER_CATALYST_CWD` | Local agent working directory. |
| `CAREER_CATALYST_DATA_DIR`, `CAREER_CATALYST_DB_NAME` | SQLite location (`data/catalyst-sdk.sqlite` by default). |
| `CAREER_CATALYST_CLOUD_REPO_URL` | **Required** when `RUNTIME=cloud`. |
| `CAREER_CATALYST_CLOUD_REF` | Branch/ref for cloud repo (default `main`). |
| `CAREER_CATALYST_CLOUD_AUTO_PR` | Cloud PR behavior (`true` / `1`). |
| `CAREER_CATALYST_CLOUD_SKIP_REVIEWER` | Defaults to skip reviewer unless set to `false`. |
| `CAREER_CATALYST_CLOUD_ACCOUNT_DEFAULT_MODEL` | If `true`/`1`, omit explicit model on cloud (account default). |
| `CAREER_CATALYST_RESUME_AGENT` | Agent id for `sdk:send` resume path. |
| `CAREER_CATALYST_AGENT_NAME` | Display name for agents. |

**Mocking / isolation tips**

- Point **`CAREER_CATALYST_DATA_DIR`** at a temp directory to avoid touching real `data/` during experiments.
- For future or ad-hoc tests that call `loadConfig()` more than once, `resetConfigCacheForTests()` in `src/config/env.ts` clears the config singleton (intended for test harnesses, not production CLI use).

---

## By codebase area

### Root (`package.json`, `tsconfig.json`, `AGENTS.md`)

| Workflow | Steps |
|----------|--------|
| **Sanity after clone** | `npm install` → `npm run typecheck` → `npm run build`. |
| **CI-style gate** | `npm run typecheck` only (no ESLint in this repo). |

### Configuration (`src/config/env.ts`)

| Workflow | Steps |
|----------|--------|
| **Validate env parsing** | Set combinations in `.env` or export vars, run `npm run sdk:whoami` (prints runtime, model preference, paths). |
| **Test cloud requirements** | `CAREER_CATALYST_RUNTIME=cloud` without `CAREER_CATALYST_CLOUD_REPO_URL` should throw at startup with a clear error. |

### CLI entrypoints (`src/scripts/`)

| Script | Workflow |
|--------|----------|
| **`sdk:whoami`** | Fast check: key works, `Cursor.me`, model list (cached), config echo. No agent run. |
| **`sdk:prompt`** | End-to-end **`Agent.prompt`**: writes run row to SQLite via `run-recorder`. Exit `2` if run status is `error`. |
| **`sdk:send`** | **`withCareerCatalystAgent`**: creates agent, streams assistant text, persists session + run. Set **`CAREER_CATALYST_RESUME_AGENT=<id>`** to resume a stored session (ids appear in script output / DB). |

### Agent wiring (`src/infrastructure/agent-factory.ts`, `with-agent.ts`)

| Workflow | Steps |
|----------|--------|
| **Local vs cloud options** | Toggle `CAREER_CATALYST_RUNTIME` and cloud vars; run `sdk:prompt` or `sdk:send` and confirm printed runtime/repo matches `.env`. |
| **Resume path** | Run `sdk:send` once, note `agent id`, set `CAREER_CATALYST_RESUME_AGENT`, run again with the **same** runtime config (mismatch errors if runtime differs from stored session). |

### Model resolution (`src/infrastructure/model-registry.ts`)

| Workflow | Steps |
|----------|--------|
| **Model list + validation** | `sdk:whoami` lists models; set `CURSOR_MODEL` to a bogus id and watch stderr for fallback warning during agent creation. |
| **Cache behavior** | Model list is cached ~5 minutes; `sdk:whoami` calls `invalidateModelCache()` each run so the list is fresh for that script. |

### Persistence (`src/infrastructure/persistence/store.ts`)

| Workflow | Steps |
|----------|--------|
| **Database creation** | After first agent script run, confirm `${CAREER_CATALYST_DATA_DIR:-data}/${CAREER_CATALYST_DB_NAME:-catalyst-sdk.sqlite}` exists. |
| **Inspect tables** | `sqlite3 <path> '.tables'` — expect `sdk_agent_sessions`, `sdk_runs`. |

### Run logging (`src/infrastructure/run-recorder.ts`)

| Workflow | Steps |
|----------|--------|
| **Verify inserts** | After `sdk:prompt` / `sdk:send`, query `sdk_runs` for latest `run_id`, `status`, `prompt_preview`. |

### Library surface (`src/index.ts`)

| Workflow | Steps |
|----------|--------|
| **Programmatic use** | Import exported helpers after `npm run build`; small scripts can use `tsx` against source with `.js` import paths matching `package.json` `"type":"module"`. |

---

## Operational notes

- **`node:sqlite` ExperimentalWarning** on Node 22 is expected.
- **`CursorAgentError`** from the SDK: scripts print message and exit `1` (or `2` for failed run status where applicable).
- **Secrets:** never commit `.env`; use the host’s secret injection for `CURSOR_API_KEY` in CI or Cloud agent environments.

---

## Maintaining this skill

When you discover a new runbook step (e.g. a new npm script, env var, SDK edge case, or SQLite inspection query):

1. **Update `.env.example` and `AGENTS.md`** if the change is user-facing.
2. **Add or adjust a row** in the env toggles table and the matching **by-area workflow** above.
3. **Keep commands copy-pasteable** and prefer concrete file paths over prose.

Treat this file as the **fast path for Cloud agents**; deeper product docs stay in `AGENTS.md` and inline code.
