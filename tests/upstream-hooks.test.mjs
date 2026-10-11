/**
 * Repo-side static pins for the bubble-decoration hook (ADR-0006) and the
 * shell-frame alignment (ADR-0009): the built client must carry those
 * selectors exactly as designed and must never re-pin a dead hash. Runtime-side
 * hook drift is covered by scripts/verify-upstream-hooks.mjs; this file pins
 * the repo side.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const client = readFileSync("lib/client.js", "utf8");
const UNION = ':is([class*="Sixlwa_bubble"], [class*="userStack"] > [class*="_bubble"])';
const GOAL_UNION = ':is([class*="oRe1gG_bubble"], [class*="_stack"] > [class*="_bubble"])';

test("bubble decoration: union selector ships in all three skins (light + dark)", () => {
	// 2 rules per skin × 3 skins, per surface (chat user bubble + goal-panel
	// bubble, v1.0.4) — the exact-hash and structural branches always ship
	// together; a skin missing a union is a fix regression. (v1.4.0 removed
	// the tgcf skin: 8 → 6 occurrences.)
	assert.equal(client.split(UNION).length - 1, 6, "chat user-bubble union");
	assert.equal(client.split(GOAL_UNION).length - 1, 6, "goal-panel bubble union");
});

test("Desktop backdrop bundle carries the public marker and all stable skin scopes", () => {
  assert.ok(client.includes("html[data-windows-titlebar]"), "Desktop override must be gated by the public Windows marker");
  for (const attribute of ["data-dsh-openbmc-skin", "data-dsh-uefi-harness", "data-dsh-meirenzhi-skin"]) {
    assert.ok(client.includes(attribute), `built client is missing skin scope ${attribute}`);
  }
  assert.ok(!client.includes(".centerCol"), "Desktop styling must not depend on a Host CSS Modules class");
});

test("shell-frame alignment ships exactly once, marker-gated, structural local names only (ADR-0009)", () => {
  const STRIP = 'html[data-windows-titlebar] [class*="_frame"]:has(> [class*="_sidebarCol"])::before{background:0 0}';
  const COLUMN = 'html[data-windows-titlebar] [class*="_frame"] > [class*="_sidebarCol"]{background:0 0}';
  const ROOT = 'html[data-windows-titlebar] [class*="_sidebarCol"] > [class*="_root"]{background:0 0}';
  // Runtime-level emission: one copy for all skins, mounted per skin at runtime.
  assert.equal(client.split(STRIP).length - 1, 1, "caption-strip single-paint rule");
  assert.equal(client.split(COLUMN).length - 1, 1, "sidebar-column single-paint rule");
  assert.equal(client.split(ROOT).length - 1, 1, "sidebar-root single-paint rule (v2: the ui-sidebar root paints the fill again inside the column)");
  // v4: the opaque shell-fill token override (light + dark template pair).
  assert.ok(client.includes("html[data-windows-titlebar] ${body}{--dsw-specific-sidebar-fill:"), "opaque token override template ships");
  assert.ok(client.includes("[data-ds-dark-theme]{--dsw-specific-sidebar-fill:"), "dark variant of the opaque token override ships");
  assert.ok(client.includes("!important}"), "the token override must stay !important (beats the theme's published value)");
  assert.ok(!client.includes("caption.css"), "the caption sampler machinery is gone (superseded by the opaque token)");
  // ADR-0006 doctrine: exact hashed pins are banned; structural local names
  // ([class*="_local"]) are allowed and pinned by scripts/verify-upstream-hooks.mjs.
  assert.ok(!/[A-Za-z0-9]{2,}_(frame|sidebarCol|root)/.test(client), "a hashed host class got pinned — that is the ADR-0006 failure mode");
});

test("bubble decoration: the dead rc.2 hash gdEzaW must never return", () => {
	assert.ok(!client.includes("gdEzaW"), "gdEzaW is the 0.1.1-rc.2 hash that rc.1 rebuilt away — pinning it again re-arms the ADR-0006 failure mode");
});
