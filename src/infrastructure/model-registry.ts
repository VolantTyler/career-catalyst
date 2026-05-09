import { Cursor, type ModelListItem } from "@cursor/sdk";

const TTL_MS = 5 * 60 * 1000;

let cache: { models: ModelListItem[]; fetchedAt: number } | null = null;

export async function listModelsCached(apiKey: string): Promise<ModelListItem[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.models;
  }
  const models = await Cursor.models.list({ apiKey });
  cache = { models, fetchedAt: now };
  return models;
}

export function invalidateModelCache(): void {
  cache = null;
}

/**
 * Resolve a stable `{ id }` for local agents. For `"auto"`, uses the first
 * available model from the API list, then `composer-2`, then raw `"auto"` as last resort.
 */
export async function resolveModelSelection(
  apiKey: string,
  preferred: string
): Promise<{ id: string }> {
  const models = await listModelsCached(apiKey);
  const ids = new Set(models.map((m) => m.id));

  if (preferred === "auto") {
    if (ids.has("composer-2")) {
      return { id: "composer-2" };
    }
    if (models[0]) {
      return { id: models[0].id };
    }
    return { id: "auto" };
  }

  if (ids.has(preferred)) {
    return { id: preferred };
  }

  console.warn(
    `[career-catalyst] Model "${preferred}" not in Cursor.models.list(); falling back.`
  );
  if (ids.has("composer-2")) {
    return { id: "composer-2" };
  }
  if (models[0]) {
    return { id: models[0].id };
  }
  return { id: "auto" };
}
