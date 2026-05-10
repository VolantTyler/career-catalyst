# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Career Catalyst is a TypeScript CLI research agent built on `@cursor/sdk`. It has no web server or Docker services — it's a collection of scripts that call the Cursor Cloud Agents API.

### Prerequisites

- **Node.js >= 22** (required for built-in `node:sqlite`)
- **`CURSOR_API_KEY`** environment variable (or in `.env` file) — all scripts fail without it

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Typecheck (lint) | `npm run typecheck` |
| Build | `npm run build` |
| Verify API key + list models | `npm run sdk:whoami` |
| One-shot agent prompt | `npm run sdk:prompt` |
| Multi-turn agent send | `npm run sdk:send` |

### Non-obvious notes

- There is no ESLint or dedicated linter configured; `npm run typecheck` (`tsc --noEmit`) is the only static analysis step.
- The `node:sqlite` module emits an `ExperimentalWarning` on Node 22 — this is expected and not an error.
- SQLite database is auto-created at `data/catalyst-sdk.sqlite` on first run; no migrations needed.
- All scripts load `.env` from the project root via `dotenv`. Copy `.env.example` to `.env` and set `CURSOR_API_KEY`.
- The `@cursor/sdk` package has native dependencies (via `better-sqlite3` transitive dep) — `npm install` handles compilation automatically.
