import { Agent, CursorAgentError } from "@cursor/sdk";
import { loadConfig } from "../config/env.js";
import { resolveAgentCreation } from "../infrastructure/agent-factory.js";
import { openCatalystStore } from "../infrastructure/persistence/store.js";
import { recordRunResult } from "../infrastructure/run-recorder.js";

interface DateWindow {
  start: string;
  end: string;
}

interface DiscoveredEventInput {
  name: string;
  registrationLink: string;
  date: string;
  description: string;
  location: string;
}

interface EventDiscoveryPayload {
  searchWindowStart: string;
  searchWindowEnd: string;
  events: DiscoveredEventInput[];
}

const TOPICS = [
  "artificial intelligence",
  "applied AI",
  "AI agents",
  "agent orchestration",
  "LLM applications",
  "agentic systems",
  "GenAI engineering",
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDateWindow(now: Date = new Date()): DateWindow {
  return {
    start: isoDate(now),
    end: isoDate(addDays(now, 42)),
  };
}

function buildPrompt(window: DateWindow): string {
  const topicList = TOPICS.map((topic) => `- ${topic}`).join("\n");
  return [
    "You are researching events for a SQLite-backed prospecting database.",
    `Today is ${window.start}.`,
    `Find real events scheduled from ${window.start} through ${window.end}, inclusive.`,
    "",
    "Event scope:",
    "- In-person events in New York City or New Jersey.",
    "- Online events are allowed only when they are hosted by, affiliated with, or clearly targeted at NYC/NJ communities or organizations.",
    "- Focus on these topics or very close neighbors:",
    topicList,
    "",
    "Include only events that have a working official registration, RSVP, or event detail page.",
    "Exclude events with ambiguous dates, expired listings, outside-of-window dates, or topics that are not meaningfully AI-related.",
    "Verify each event on its event page before including it.",
    "",
    "Return ONLY valid JSON with this exact shape:",
    "{",
    '  "searchWindowStart": "YYYY-MM-DD",',
    '  "searchWindowEnd": "YYYY-MM-DD",',
    '  "events": [',
    "    {",
    '      "name": "Event name",',
    '      "registrationLink": "https://...",',
    '      "date": "ISO 8601 date or date-time string exactly as best supported by the source",',
    '      "description": "One or two sentences summarizing why the event matches the scope",',
    '      "location": "Venue and city/state, or Online"',
    "    }",
    "  ]",
    "}",
    "",
    "Requirements:",
    "- Deduplicate the same event across multiple listings.",
    "- Prefer the official organizer page over mirrors or listing aggregators.",
    "- If information is uncertain, omit that event.",
    "- Do not include Markdown, code fences, commentary, or explanatory prose outside the JSON.",
  ].join("\n");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(
  value: unknown,
  fieldName: string,
  index?: number
): string {
  if (typeof value !== "string") {
    throw new Error(
      `${fieldName} must be a string${index == null ? "" : ` for event ${index + 1}`}`
    );
  }
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(
      `${fieldName} must be non-empty${index == null ? "" : ` for event ${index + 1}`}`
    );
  }
  return normalized;
}

function normalizeUrl(value: unknown, index: number): string {
  const raw = readNonEmptyString(value, "registrationLink", index);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (error) {
    throw new Error(
      `registrationLink must be a valid URL for event ${index + 1}: ${String(error)}`
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `registrationLink must use http or https for event ${index + 1}`
    );
  }
  return parsed.toString();
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  throw new Error("The agent response did not contain a JSON object.");
}

function parseEvent(item: unknown, index: number): DiscoveredEventInput {
  if (!isRecord(item)) {
    throw new Error(`Event ${index + 1} must be an object.`);
  }

  return {
    name: readNonEmptyString(item.name, "name", index),
    registrationLink: normalizeUrl(item.registrationLink, index),
    date: readNonEmptyString(item.date, "date", index),
    description: readNonEmptyString(item.description, "description", index),
    location: readNonEmptyString(item.location, "location", index),
  };
}

function parseDiscoveryPayload(raw: string): EventDiscoveryPayload {
  const parsed = JSON.parse(extractJson(raw)) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("The agent response must parse to an object.");
  }

  if (!Array.isArray(parsed.events)) {
    throw new Error('The agent response must contain an "events" array.');
  }

  return {
    searchWindowStart: readNonEmptyString(
      parsed.searchWindowStart,
      "searchWindowStart"
    ),
    searchWindowEnd: readNonEmptyString(parsed.searchWindowEnd, "searchWindowEnd"),
    events: parsed.events.map((item, index) => parseEvent(item, index)),
  };
}

function dedupeEvents(events: DiscoveredEventInput[]): DiscoveredEventInput[] {
  const seen = new Set<string>();
  const deduped: DiscoveredEventInput[] = [];

  for (const event of events) {
    const key = [
      event.name.toLowerCase(),
      event.date.toLowerCase(),
      event.registrationLink.toLowerCase(),
    ].join("::");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const window = buildDateWindow();
  const prompt = buildPrompt(window);
  const { options } = await resolveAgentCreation(config);
  const store = openCatalystStore(config);

  try {
    try {
      const result = await Agent.prompt(prompt, options);
      console.log(`run id: ${result.id}`);
      console.log(`status: ${result.status}`);
      if (result.durationMs != null) {
        console.log(`durationMs: ${result.durationMs}`);
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
      if (!result.result) {
        throw new Error("The agent completed without returning result text.");
      }

      const payload = parseDiscoveryPayload(result.result);
      const events = dedupeEvents(payload.events);
      if (events.length === 0) {
        throw new Error("The agent returned zero valid events.");
      }

      if (
        payload.searchWindowStart !== window.start ||
        payload.searchWindowEnd !== window.end
      ) {
        console.warn(
          `Warning: agent reported search window ${payload.searchWindowStart}..${payload.searchWindowEnd}; expected ${window.start}..${window.end}. Persisting the requested window.`
        );
      }

      for (const event of events) {
        store.recordDiscoveredEvent({
          runId: result.id,
          searchWindowStart: window.start,
          searchWindowEnd: window.end,
          name: event.name,
          registrationLink: event.registrationLink,
          eventDate: event.date,
          description: event.description,
          location: event.location,
        });
      }

      console.log(`stored events: ${events.length}`);
      console.log(`database: ${config.databasePath}`);
      console.log("");
      for (const event of events) {
        console.log(`- ${event.date} | ${event.name}`);
        console.log(`  ${event.location}`);
        console.log(`  ${event.registrationLink}`);
      }
    } catch (error) {
      if (error instanceof CursorAgentError) {
        console.error(`Startup / SDK error: ${error.message}`);
        console.error(`retryable: ${error.isRetryable}`);
        process.exit(1);
      }
      throw error;
    }
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
