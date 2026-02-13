import fs from "node:fs";
import path from "node:path";

const indexPath = path.resolve(process.cwd(), "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error(`index.html not found at ${indexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");
const updated = html.replace(/\s+crossorigin(?=[\s>])/g, "");

if (html !== updated) {
  fs.writeFileSync(indexPath, updated);
  console.log("Removed crossorigin attributes from dist/index.html");
} else {
  console.log("No crossorigin attributes found in dist/index.html");
}
