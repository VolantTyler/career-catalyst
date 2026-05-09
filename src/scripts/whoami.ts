/**
 * List the authenticated Cursor user, top available models, and config summary.
 */
import { Cursor } from "@cursor/sdk";
import { loadConfig } from "../config/env.js";
import { listModelsCached, invalidateModelCache } from "../infrastructure/model-registry.js";

async function main(): Promise<void> {
  const config = loadConfig();
  invalidateModelCache();

  const me = await Cursor.me({ apiKey: config.apiKey });
  console.log("User / key:");
  console.log(`  apiKeyName: ${me.apiKeyName}`);
  if (me.userEmail) {
    console.log(`  email: ${me.userEmail}`);
  }

  const models = await listModelsCached(config.apiKey);
  console.log("\nAvailable models (first 25):");
  for (const m of models.slice(0, 25)) {
    console.log(`  - ${m.id} (${m.displayName})`);
  }
  if (models.length > 25) {
    console.log(`  … and ${models.length - 25} more`);
  }

  console.log("\nCareer Catalyst config:");
  console.log(`  runtime: ${config.runtime}`);
  console.log(`  model preference: ${config.modelPreference}`);
  console.log(`  cwd (local): ${config.cwd}`);
  console.log(`  database: ${config.databasePath}`);
  if (config.runtime === "cloud") {
    console.log(`  cloud repo: ${config.cloudRepoUrl}`);
    console.log(`  cloud ref: ${config.cloudStartingRef}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
