// Single-rule lint for tests/ (execution-review R1 out-of-plan suggestion,
// adopted 2026-10-21). The interface-narrowing execution hit exactly this
// trap: the panel test fake gained a counting `refetch` member while a no-op
// `refetch` already sat later in the same object literal — the later key
// silently shadowed the counter and every test stayed green (fixed in
// bc90eee). Duplicate keys in an object literal are always a mistake; this
// rule makes that class of drift fail `pnpm run check` instead of hiding
// behind key order. Scope stays tests/ by design — no stylistic ruleset.
export default [
  {
    ignores: ["lib/**"],
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: { "no-dupe-keys": "error" },
  },
];
