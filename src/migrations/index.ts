import { getStoreValue, setStoreValue, STORE_PATH } from "@/api/store";
import { Store } from "@tauri-apps/plugin-store";
import { Migration } from "./types";

// Keep track of migrations that have been run
let lastRunVersion: string | null = null;

// Cache for loaded migrations
let cachedMigrations: Migration[] | null = null;

// Function to load all migrations dynamically using Vite's glob import
async function loadMigrations(): Promise<Migration[]> {
  if (cachedMigrations) {
    return cachedMigrations;
  }

  const migrations: Migration[] = [];
  const migrationModules = await Promise.all(
    Object.values(
      import.meta.glob<{ migration: Migration }>("./versions/*.ts")
    ).map((module) => module())
  );

  migrationModules.forEach((module) => {
    if (module.migration) {
      migrations.push(module.migration);
    }
  });

  cachedMigrations = migrations;
  return migrations;
}

function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split(".").map(Number);
  const v2Parts = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
}

export async function runMigrations(targetVersion: string): Promise<void> {
  // Get current version from store
  const currentVersion =
    (await getStoreValue<string>("app_version")) ?? "0.0.0";

  // Always log versions for debugging
  console.log("Current version:", currentVersion);
  console.log("Target version:", targetVersion);

  // If we've already run migrations for this version, skip
  if (lastRunVersion === targetVersion) {
    console.log("Skipping migrations - already run for this version");
    return;
  }

  // If versions are the same, no migration needed
  if (currentVersion === targetVersion) {
    console.log("Skipping migrations - versions are the same");
    lastRunVersion = targetVersion;
    return;
  }

  // Load and sort migrations
  const migrations = await loadMigrations();
  const migrationsToRun = migrations
    .filter((migration) => {
      const afterCurrent =
        compareVersions(migration.version, currentVersion) > 0;
      const beforeOrEqualTarget =
        compareVersions(migration.version, targetVersion) <= 0;
      return afterCurrent && beforeOrEqualTarget;
    })
    .sort((a, b) => compareVersions(a.version, b.version));

  // Run each migration in order
  for (const migration of migrationsToRun) {
    console.log(
      `Running migration for version ${migration.version}: ${migration.description}`
    );
    await migration.up();
  }

  // Update the version in store
  await setStoreValue("app_version", targetVersion);
  lastRunVersion = targetVersion;

  // Force reload the store after all migrations are complete
  await Store.load(STORE_PATH);
}
