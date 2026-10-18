import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dataDirForProfile, hostProfileFor } from "../src/index.js";
import { createPersonalizationStore } from "../src/host/personalization/store.js";

test("Host profile detection follows Desktop's profile cwd, never just the presence of Desktop files", () => {
  const home = join(process.cwd(), ".test-dsh-home");
  assert.equal(hostProfileFor(home, join(home, "profiles", "desktop")), "desktop");
  assert.equal(hostProfileFor(home, join(home, "profiles", "web")), "web");
  assert.equal(hostProfileFor(home, home), "web");
  assert.equal(hostProfileFor("~/.dsh", join(homedir(), ".dsh", "profiles", "desktop")), "desktop",
    "Desktop shell expands ~/ before starting the Host");
});

test("Desktop migrates a private copy; Web state is unchanged by opposite default normalization", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dsh-skins-profiles-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const webDir = dataDirForProfile(root, "web");
  mkdirSync(join(webDir, "assets"), { recursive: true });
  const original = JSON.stringify({ configVersion: 1, revision: 7,
    skins: { meirenzhi: { panelOpacity: 66 } }, library: {} });
  writeFileSync(join(webDir, "state.json"), original);
  writeFileSync(join(webDir, "assets", "keep.bin"), "image bytes");
  const desktopDir = dataDirForProfile(root, "desktop");
  assert.notEqual(webDir, desktopDir);
  assert.equal(readFileSync(join(webDir, "state.json"), "utf8"), original);
  assert.equal(readFileSync(join(desktopDir, "assets", "keep.bin"), "utf8"), "image bytes");
  assert.equal(dataDirForProfile(root, "desktop"), desktopDir, "migration runs once");
  assert.deepEqual(readdirSync(root).filter((name) => name.startsWith(".dsh-skins-desktop-migrate-")), [],
    "no incomplete staging directory remains");
  const desktop = createPersonalizationStore({ dataDir: desktopDir, profile: "desktop" });
  assert.deepEqual(desktop.snapshot().skins, {}, "Desktop considers 66 the default and cleans only its own copy");
  assert.equal(readFileSync(join(webDir, "state.json"), "utf8"), original,
    "Desktop normalization must not overwrite Web data");
  const web = createPersonalizationStore({ dataDir: webDir, profile: "web" });
  assert.deepEqual(web.snapshot().skins.meirenzhi, { panelOpacity: 66 },
    "Web retains its deliberate 66 override");
  assert.equal(existsSync(join(desktopDir, "state.json")), true);
});
