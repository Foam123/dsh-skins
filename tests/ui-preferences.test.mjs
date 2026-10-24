/**
 * Plugin-wide UI preferences (entry placement) — store + settings page.
 *
 * The placement lives in the plugin's own Host store, NOT in the Host's
 * settings document: the value is browser-visible state about this plugin's
 * own chrome, it must survive升级 without a schema migration, and keeping it
 * beside the personalization data means one write path (ADR-0015 dialect)
 * and one cross-tab sync mechanism.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPersonalizationStore } from "../src/host/personalization/store.js";
import {
  defaultUiPreferences,
  UI_PREFERENCES,
  validateUiPreference,
} from "../src/shared/personalization/catalog.js";
import { createSkinsSettingsSection, SETTINGS_CSS } from "../src/client/settings-page.js";
import { DICTS } from "../src/client/dicts.js";
import { createFakeReact, jsx, flatten } from "./fake-react.mjs";

const NOW = 1_700_000_000_000;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dsh-skins-ui-prefs-"));
}

function makeStore(dir) {
  return createPersonalizationStore({ dataDir: dir, profile: "web", now: () => NOW });
}

function setUi(store, key, value) {
  return store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "setUi", key, value }],
  });
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

test("entryPlacement defaults to settings — the sidebar foot is clean out of the box", () => {
  assert.deepEqual(defaultUiPreferences(), { entryPlacement: "settings" });
  assert.deepEqual(UI_PREFERENCES.entryPlacement.values, ["settings", "sidebar"]);
  assert.deepEqual(validateUiPreference("entryPlacement", "sidebar"), { ok: true });
  assert.deepEqual(validateUiPreference("entryPlacement", "somewhere"), { ok: false, code: "BAD_VALUE" });
  assert.deepEqual(validateUiPreference("nope", "sidebar"), { ok: false, code: "UNKNOWN_FIELD" });
});

test("defaultUiPreferences returns a fresh object every call", () => {
  const first = defaultUiPreferences();
  first.entryPlacement = "sidebar";
  assert.equal(defaultUiPreferences().entryPlacement, "settings", "callers may mutate their copy");
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

test("snapshot always exposes a complete ui map (defaults applied)", () => {
  const dir = tempDir();
  const snapshot = makeStore(dir).snapshot();
  assert.deepEqual(snapshot.ui, { entryPlacement: "settings" }, "fresh install reads the factory placement");
});

test("setUi persists the placement and bumps the revision once", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const before = store.snapshot().revision;
  const result = await setUi(store, "entryPlacement", "sidebar");
  assert.equal(result.revision, before + 1);
  assert.deepEqual(result.ui, { entryPlacement: "sidebar" }, "the write answers with the effective map");
  assert.equal(store.snapshot().ui.entryPlacement, "sidebar");

  const reopened = makeStore(dir);
  assert.equal(reopened.snapshot().ui.entryPlacement, "sidebar", "the choice survives a restart");
  const onDisk = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.deepEqual(onDisk.ui, { entryPlacement: "sidebar" }, "stored beside the personalization data");
});

test("writing the factory value back does not persist an override", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setUi(store, "entryPlacement", "sidebar");
  await setUi(store, "entryPlacement", "settings");
  const onDisk = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.equal(onDisk.ui, undefined, "default-equal value leaves no husk (same ruling as skin fields)");
  assert.equal(store.snapshot().ui.entryPlacement, "settings");
});

test("deleteUi removes the override and falls back to the factory value", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setUi(store, "entryPlacement", "sidebar");
  await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "deleteUi", key: "entryPlacement" }],
  });
  assert.equal(store.snapshot().ui.entryPlacement, "settings");
});

test("unknown ui keys and values are rejected without writing", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const revision = store.snapshot().revision;
  await assert.rejects(
    () => setUi(store, "entryPlacement", "elsewhere"),
    (error) => error.code === "INVALID_CONFIG" && error.params.issues[0].code === "BAD_VALUE",
  );
  await assert.rejects(
    () => setUi(store, "unknownKey", "sidebar"),
    (error) => error.code === "INVALID_CONFIG" && error.params.issues[0].code === "UNKNOWN_FIELD",
  );
  assert.equal(store.snapshot().revision, revision, "no revision bump on rejection");
  assert.equal(store.snapshot().ui.entryPlacement, "settings");
});

test("a stale baseRevision is refused for ui writes too", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const stale = store.snapshot().revision;
  await setUi(store, "entryPlacement", "sidebar");
  await assert.rejects(
    () => store.applyOperations({
      baseRevision: stale,
      operations: [{ op: "setUi", key: "entryPlacement", value: "settings" }],
    }),
    (error) => error.code === "REVISION_CONFLICT",
  );
  assert.equal(store.snapshot().ui.entryPlacement, "sidebar", "the concurrent write wins");
});

test("load normalization drops unknown ui keys and a whole malformed ui object", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setUi(store, "entryPlacement", "sidebar");
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.ui.bogusKey = "x";
  raw.ui.entryPlacement = "nonsense";
  writeState(statePath, raw);

  const reopened = makeStore(dir);
  assert.deepEqual(reopened.snapshot().ui, { entryPlacement: "settings" },
    "both the unknown key and the invalid value are dropped");
});

test("a non-object ui section is treated as recoverable corruption of that field only", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setUi(store, "entryPlacement", "sidebar");
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.ui = "nope";
  writeState(statePath, raw);

  const reopened = makeStore(dir);
  assert.deepEqual(reopened.snapshot().ui, { entryPlacement: "settings" },
    "the whole section falls back to factory defaults");
  assert.equal(reopened.snapshot().mode, "normal", "the rest of the config is untouched");
});

test("ui writes never disturb skin overrides (one revision, one commit)", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "set", skinId: "openbmc", key: "panelOpacity", value: 70 }],
  });
  await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [
      { op: "setUi", key: "entryPlacement", value: "sidebar" },
      { op: "set", skinId: "openbmc", key: "panelOpacity", value: 80 },
    ],
  });
  const snapshot = store.snapshot();
  assert.equal(snapshot.ui.entryPlacement, "sidebar");
  assert.equal(snapshot.skins.openbmc.panelOpacity, 80, "mixed batches land atomically");
});

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

function makeConfigClient(initialUi = { entryPlacement: "sidebar" }) {
  const listeners = new Set();
  let state = {
    status: "synced", revision: 3, mode: "normal",
    skins: {}, library: [], references: {}, dirtyCount: 0, notices: [], ui: initialUi,
  };
  const calls = { setUiPreference: [] };
  const emit = () => { for (const listener of [...listeners]) listener(state); };
  return {
    calls,
    getState: () => state,
    onStateChange: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    canWrite: () => true,
    effectiveOverrides: () => ({}),
    preview: () => {},
    previewReset: () => {},
    flushNow: async () => ({ flushed: 0 }),
    setUiPreference: async (key, value) => {
      calls.setUiPreference.push([key, value]);
      state = { ...state, revision: state.revision + 1, ui: { ...state.ui, [key]: value } };
      emit();
      return { ui: state.ui };
    },
    referencesFor: () => [],
    uploadImage: async () => ({ error: "offline" }),
    deleteImage: async () => ({ error: "offline" }),
    confirmRecovery: async () => ({ ok: true }),
    refetch: async () => {},
    assetUrl: () => null,
  };
}

function mountSection({ initialUi = { entryPlacement: "sidebar" }, activeSkin = "openbmc", hostT } = {}) {
  const react = createFakeReact();
  const configClient = makeConfigClient(initialUi);
  let active = activeSkin;
  let themeChoice = "system";
  const runtime = {
    officialId: "official",
    active: () => active,
    select: (id) => { active = id; },
    list: () => [
      { id: "openbmc", label: "OpenBMC", description: "bmc" },
      { id: "meirenzhi", label: "MRZ", description: "mrz" },
    ],
  };
  // A real dictionary lookup (zh): the page must render copy, never raw keys.
  const tr = (key) => DICTS.zh[key] ?? key;
  const Section = createSkinsSettingsSection({
    jsx,
    react,
    runtime,
    configClient,
    tr,
    PersonalizationPanel: null,
    getThemePreference: () => themeChoice,
    setThemePreference: (id) => { themeChoice = id; },
  });
  const props = hostT === undefined ? {} : { t: hostT };
  const render = () => react.render(() => react.instantiate(jsx(Section, props)));
  render();
  return {
    react,
    configClient,
    // Re-instantiating reads the persistent hook frames, i.e. the state as
    // of the latest setState — the fake React has no live tree to observe.
    tree: () => render(),
    getActive: () => active,
    getTheme: () => themeChoice,
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function toggleOf(tree) {
  return flatten(tree).find((node) => node.type === "button" && node.props.role === "switch") ?? null;
}

test("the settings page renders the placement switch reflecting persisted state", () => {
  const on = mountSection({ initialUi: { entryPlacement: "sidebar" } });
  assert.equal(toggleOf(on.tree()).props["aria-checked"], true, "sidebar placement → switch on");

  const off = mountSection({ initialUi: { entryPlacement: "settings" } });
  assert.equal(toggleOf(off.tree()).props["aria-checked"], false, "settings placement → switch off");
});

test("the switch writes the placement through the config client (auto-save, no save button)", async () => {
  const h = mountSection({ initialUi: { entryPlacement: "sidebar" } });
  // Let the mount effects drain (the fake React runs them at the next
  // microtask checkpoint, like React's passive effects): the page subscribes
  // to the config client there, and the toggle reads that state.
  await tick();
  toggleOf(h.tree()).props.onClick();
  await tick();
  await tick();
  assert.deepEqual(h.configClient.calls.setUiPreference, [["entryPlacement", "settings"]],
    "turning it off persists the settings placement");
  assert.equal(toggleOf(h.tree()).props["aria-checked"], false, "the switch follows the persisted answer");
});

test("turning the switch back on restores the sidebar row", async () => {
  const h = mountSection({ initialUi: { entryPlacement: "settings" } });
  await tick();
  toggleOf(h.tree()).props.onClick();
  await tick();
  await tick();
  assert.deepEqual(h.configClient.calls.setUiPreference, [["entryPlacement", "sidebar"]]);
  assert.equal(toggleOf(h.tree()).props["aria-checked"], true);
});

test("the page still offers appearance and every skin", () => {
  const h = mountSection();
  const buttons = flatten(h.tree()).filter((node) => node.type === "button");
  assert.ok(buttons.some((node) => node.props["aria-pressed"] === true && node.props.className.includes("dsh-skins-set-theme")),
    "the current appearance is pressed");
  assert.equal(buttons.filter((node) => node.props.className?.includes("dsh-skins-set-theme")).length, 3,
    "all three appearance choices render");
  assert.equal(buttons.filter((node) => node.props.className?.startsWith("dsh-skins-set-skin")).length, 3,
    "official + two registered skins");
});

test("choosing another skin through the page switches the runtime", async () => {
  const h = mountSection();
  const rows = flatten(h.tree()).filter((node) => node.type === "button" && node.props.className?.startsWith("dsh-skins-set-skin"));
  const meirenzhi = rows.find((node) => flatten(node).some((child) => child.props?.children === "MRZ"));
  meirenzhi.props.onClick();
  await tick();
  assert.equal(h.getActive(), "meirenzhi");
});

test("the page renders localized copy, not raw dictionary keys", () => {
  const h = mountSection();
  const texts = [];
  const collect = (node) => {
    if (node === null || node === undefined || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(collect);
    const children = node.props?.children;
    if (typeof children === "string") texts.push(children);
    collect(children);
  };
  collect(h.tree());
  const joined = texts.join(" | ");
  assert.ok(joined.includes(DICTS.zh["settings.title"]), "page title is translated");
  assert.ok(joined.includes(DICTS.zh["settings.entryPlacement"]), "the switch is labelled");
  assert.ok(joined.includes(DICTS.zh["appearance.title"]), "the appearance heading is translated");
  for (const text of texts) {
    assert.ok(!/^(settings|appearance|skins)\.[a-zA-Z.]+$/.test(text), `no raw key leaks into the page: ${text}`);
  }
});

test("the page ignores a host-namespace t and always uses its own dictionary", () => {
  // The host binds slot props t to ITS namespace (ui-settings-general binds
  // "settings"), where none of our keys exist. A page that trusted that
  // prop would render bare key names.
  const h = mountSection({ hostT: (key) => `HOST:${key}` });
  const texts = [];
  const collect = (node) => {
    if (node === null || node === undefined || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(collect);
    const children = node.props?.children;
    if (typeof children === "string") texts.push(children);
    collect(children);
  };
  collect(h.tree());
  assert.ok(texts.includes(DICTS.zh["settings.title"]), "own dictionary wins");
  assert.ok(!texts.some((text) => text.startsWith("HOST:")), "the host t is never used");
});

test("the page owns its CSS block and never redefines panel/shell classes", () => {
  assert.ok(SETTINGS_CSS.split("\n").length > 0);
  for (const line of SETTINGS_CSS.split("\n")) {
    assert.ok(line.startsWith(".dsh-skins-set") || line.startsWith("@media") || line.includes(".dsh-skins-set"),
      `every rule is scoped to the page's own vocabulary: ${line.slice(0, 60)}`);
    assert.ok(!line.includes(".dsh-skins-pz-"), "the panel's interface is not restyled from here");
    assert.ok(!line.includes(".dsh-skins-pop"), "the shell's interface is not restyled from here");
  }
});

function writeState(path, value) {
  // Same atomic temp+rename shape the store uses; the tests read the file
  // straight back, so a plain write would do, but crash-shaped writes keep
  // the fixture honest.
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}
