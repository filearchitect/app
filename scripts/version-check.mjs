#!/usr/bin/env node

import fs from "node:fs";

const expectedInput = process.argv[2];
const expectedVersion = expectedInput
  ? expectedInput.replace(/^v/, "").trim()
  : null;

const packageJsonPath = "package.json";
const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoPath = "src-tauri/Cargo.toml";
const cargoLockPath = "src-tauri/Cargo.lock";

const packageVersion = JSON.parse(
  fs.readFileSync(packageJsonPath, "utf8")
).version;
const tauriVersion = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8")).version;
const cargoVersionMatch = fs
  .readFileSync(cargoPath, "utf8")
  .match(/^version = "([^"]+)"\r?$/m);
const cargoVersion = cargoVersionMatch ? cargoVersionMatch[1] : null;
const cargoLockVersion = fs
  .readFileSync(cargoLockPath, "utf8")
  .match(/\[\[package\]\]\r?\nname = "filearchitect-app"\r?\nversion = "([^"]+)"/)?.[1] ?? null;

const versions = {
  packageJson: packageVersion,
  cargoToml: cargoVersion,
  cargoLock: cargoLockVersion,
  tauriConfig: tauriVersion,
};

const uniqueVersions = new Set(Object.values(versions));

if (uniqueVersions.size !== 1) {
  console.error("Version mismatch detected:");
  console.error(`  package.json: ${versions.packageJson}`);
  console.error(`  src-tauri/Cargo.toml: ${versions.cargoToml}`);
  console.error(`  src-tauri/Cargo.lock: ${versions.cargoLock}`);
  console.error(`  src-tauri/tauri.conf.json: ${versions.tauriConfig}`);
  process.exit(1);
}

const currentVersion = versions.packageJson;

if (expectedVersion && currentVersion !== expectedVersion) {
  console.error(
    `Version does not match expected tag version: expected ${expectedVersion}, found ${currentVersion}`
  );
  process.exit(1);
}

console.log(`Version check passed: ${currentVersion}`);
