#!/usr/bin/env node

import fs from "node:fs";

const inputVersion = process.argv[2];

if (!inputVersion) {
  console.error("Usage: node scripts/version-sync.mjs <version>");
  process.exit(1);
}

const version = inputVersion.replace(/^v/, "").trim();
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!semverPattern.test(version)) {
  console.error(`Invalid semver version: "${inputVersion}"`);
  process.exit(1);
}

const packageJsonPath = "package.json";
const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoPath = "src-tauri/Cargo.toml";

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
pkg.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

const tauri = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
tauri.version = version;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauri, null, 2) + "\n");

const cargo = fs.readFileSync(cargoPath, "utf8");
const nextCargo = cargo.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);

if (!/^version = ".*"$/m.test(cargo)) {
  throw new Error("Could not update src-tauri/Cargo.toml version");
}

fs.writeFileSync(cargoPath, nextCargo);

console.log(`Synchronized app version to ${version}`);
