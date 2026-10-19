/**
 * Verdict honesty pins (ADR-0011): the upstream-hooks guard must keep its
 * verdicts machine-distinguishable. Before ADR-0011, a machine without a DSH
 * runtime printed a human-only yellow note and exited 0 — "verified" and
 * "skipped" were the same value to every caller, and the release workflow
 * blessed tags with a vacuous green. These pins make a regression loud.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join("scripts", "verify-upstream-hooks.mjs");

test("no runtime under DSH_RUNTIME_ROOT → machine-readable SKIPPED verdict, exit 0", () => {
	const emptyRoot = mkdtempSync(join(tmpdir(), "dsh-skins-empty-runtime-"));
	const res = spawnSync(process.execPath, [script], {
		env: { ...process.env, DSH_RUNTIME_ROOT: emptyRoot },
		encoding: "utf8",
	});
	assert.equal(res.status, 0, `skip must stay exit 0 (absence is not a code defect) — stderr: ${res.stderr}`);
	assert.match(res.stderr, /upstream-hooks: SKIPPED/, "the skip verdict must carry a stable greppable token (ADR-0011)");
});

test("runtime pin is an exact version, never a mutable dist-tag (ADR-0011)", () => {
	const pin = JSON.parse(readFileSync(join("scripts", "runtime-pin.json"), "utf8")).version;
	assert.match(pin, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/, `pin must be exact semver, got "${pin}"`);
});
