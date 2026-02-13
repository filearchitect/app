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

// 2) Inline compiled stylesheet to avoid runtime CSS fetch issues in packaged app.
const stylesheetHrefMatch = updated.match(
  /<link rel="stylesheet" href="([^"]+)">/
);
if (stylesheetHrefMatch) {
  const cssHref = stylesheetHrefMatch[1];
  const cssPath = path.resolve(process.cwd(), "dist", cssHref.replace(/^\.\//, ""));
  if (!fs.existsSync(cssPath)) {
    console.error(`stylesheet not found at ${cssPath}`);
    process.exit(1);
  }

  const css = fs.readFileSync(cssPath, "utf8");
  updated = updated.replace(
    stylesheetHrefMatch[0],
    `<style id="app-inline-css">${css}</style>`
  );
}

if (html !== updated) {
  fs.writeFileSync(indexPath, updated);
  console.log("Updated dist/index.html for packaged app (crossorigin removed, css inlined)");
} else {
  console.log("No post-build HTML updates required");
}
