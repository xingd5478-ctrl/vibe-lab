/* Set the public Sentry/GlitchTip DSN in shared/sentry-config.js.
   Usage: npm run sentry:set -- https://<key>@<host>/<project-id>
*/
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "shared", "sentry-config.js");
const dsn = process.argv[2] || "";
if (!dsn) {
  console.error("usage: npm run sentry:set -- https://<key>@<host>/<project-id>");
  process.exit(1);
}
let u;
try {
  u = new URL(dsn);
} catch (e) {
  console.error("invalid DSN");
  process.exit(1);
}
if (u.protocol !== "https:" || !u.username || !u.pathname.replace(/\//g, "")) {
  console.error("DSN must look like https://<key>@<host>/<project-id>");
  process.exit(1);
}
const body = `/* Public DSN for Sentry/GlitchTip. Set with: npm run sentry:set -- <dsn>
   This is a public client key, not a server secret. */
window.VIBE_SENTRY_DSN = ${JSON.stringify(dsn)};
`;
fs.writeFileSync(FILE, body);
console.log(`wrote ${path.relative(ROOT, FILE)} for ${u.host} project ${u.pathname.replace(/\//g, "")}`);
