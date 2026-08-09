// env.js — load server/.env into process.env if present.
// Imported FIRST in index.js (before db/email) so their config reads see it.
// Uses Node's built-in loader (v20.12+); no dotenv dependency.

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file (or unsupported Node) — fall back to real environment vars.
}
