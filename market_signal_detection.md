---
name: market_signal_detection
description: >-
  Research trajectory to find market signals: large tech or advertising
  companies adopting OpenClaw or ACP (Agent Client Protocol). Use when
  scanning job boards, press, repos, and filings for agent-stack adoption.
---

# Market signal detection (OpenClaw / ACP)

## Purpose

Identify **high-signal evidence** that a **large technology or advertising** company is **using or standardizing on OpenClaw** or **ACP (Agent Client Protocol)**—for Career Catalyst opportunity tracking (boutique firms, Series A, and strategic employers).

## Definitions

- **Signal (strong):** Official docs, engineering blog, conference talk, job posting (exact stack), open-source org/repo, SEC/ad regulatory filing, or vendor case study **naming OpenClaw or ACP** in production or platform strategy.
- **Signal (medium):** Partner announcement, podcast/interview with named leader, or technical article with **quotable primary source**.
- **Noise:** Rumor, anonymous posts, or generic “AI agents” with **no** OpenClaw/ACP mention—**do not** count toward the target list without corroboration.

## Workflow

1. **Query plan (5–10 minutes):** Split searches into:
   - Exact phrases: `"OpenClaw"`, `"Agent Client Protocol"`, `"ACP"` + `agents`.
   - Job boards: Greenhouse, Lever, Ashby, LinkedIn, company career sites—keywords above + “agent”, “orchestration”, “MCP”.
   - News/tech press + **GitHub** org/repo mentions + **HN**/lobste.rs threads linking primary sources.

2. **Harvest:** For each hit, capture **URL**, **date**, **company**, **quote or posting excerpt** (1–3 sentences), and **signal strength** (strong/medium).

3. **Verify:** Prefer **primary** sources; if only secondary coverage exists, open the linked primary doc or archive link.

4. **Synthesize:** Produce a table of **five companies** (or fewer if evidence is thin—then list gaps). Each row: **Company**, **Evidence summary**, **Link**, **Strength**, **Notes** (e.g. division, product).

5. **Persist:** Append summarized findings to agent memory / SQLite FTS if available; link artifacts in the Career Catalyst workspace.

## Output template

| Company | Evidence | Link | Strength | Notes |
|---------|----------|------|----------|-------|
| …       | …        | …    | strong/medium | … |

## Stop condition

Stop when **five qualified companies** are documented **or** after **two full search iterations** with documented dead ends—then report what terms and regions were exhausted.

## Refresh

Re-run monthly or when OpenClaw/ACP release cadence spikes (major conference or protocol revision).
