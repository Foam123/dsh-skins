// Single-purpose lint, wired into `pnpm run check` (execution-review R1
// out-of-plan suggestion, adopted 2026-10-21; extended to src/ same day).
// Two rules only — no stylistic ruleset by design:
//   tests/  no-dupe-keys — the panel test fake once gained a counting
//           `refetch` member while a no-op `refetch` sat later in the same
//           object literal; the later key silently shadowed the counter and
//           every test stayed green (fixed in bc90eee).
//   src/    no-undef — a released api member referencing a deleted function
//           binding (`retry,` after the retry removal) is syntactically valid
//           (`node --check` passes) and only explodes at module load; this
//           catches the dangling binding before commit.
import globals from "globals";

export default [
  {
    ignores: ["lib/**"],
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-dupe-keys": "error" },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-undef": "error" },
  },
  {
    // Client-side sources run in the browser bundle (lib/client.js).
    files: ["src/client/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    // Host-side sources run under Node (lib/index.js, the plugin entry).
    files: ["src/host/**/*.js", "src/index.js"],
    languageOptions: { globals: globals.node },
  },
];
