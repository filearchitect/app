import fs from "node:fs";
import path from "node:path";

const srcDir = path.resolve(process.cwd(), "src");

if (!fs.existsSync(srcDir)) {
  console.error(`src directory not found at ${srcDir}`);
  process.exit(1);
}

let removed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const basePath = fullPath.slice(0, -3);
    const tsPath = `${basePath}.ts`;
    const tsxPath = `${basePath}.tsx`;

    // Remove only JS files that have TS/TSX source siblings.
    if (fs.existsSync(tsPath) || fs.existsSync(tsxPath)) {
      fs.unlinkSync(fullPath);
      removed += 1;
    }
  }
}

walk(srcDir);
console.log(`Removed ${removed} emitted JS file(s) from src`);
