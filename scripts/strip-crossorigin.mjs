import fs from "node:fs";
import path from "node:path";

const indexPath = path.resolve(process.cwd(), "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error(`index.html not found at ${indexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");

// 1) Remove crossorigin attributes to avoid custom protocol edge cases.
let updated = html.replace(/\s+crossorigin(?=[\s>])/g, "");

if (html !== updated) {
  fs.writeFileSync(indexPath, updated);
  console.log("Updated dist/index.html for packaged app (crossorigin removed)");
} else {
  console.log("No post-build HTML updates required");
}
