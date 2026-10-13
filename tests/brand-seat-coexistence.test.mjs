/**
 * Brand-seat coexistence tests (2026-10-13 ds-bot single-slot incident).
 *
 * dsh-skins must never sit on the third-party magnet priority -10: a plugin
 * registering the SAME priority on a single slot throws inside its own
 * apply() and its whole activation dies (cordis fiber state=3). The runtime
 * now claims a deep base seat (-20), probes the slot ledger for occupied
 * seats, retries deeper on racing conflicts, and finally yields the cosmetic
 * brand seat entirely rather than failing the skin mount.
 *
 * References: @deepseek-ai/dsh-client-ui-slots SlotCore.register() (single:
 * name + priority 重复即抛错), @deepseek-ai/dsh-client-ui-renderer
 * SlotRegistry.inject (declaration-ready callbacks run synchronously inside
 * the caller's apply).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createSkinRuntime } from "../src/client/runtime.js";
import { createOpenBmcHarness } from "../src/client/skins/openbmc-harness/index.js";

const BRAND_SLOTS = ["sidebar.brand.mark", "sidebar.brand.name", "conversation.hero.brand.mark"];
const CONFLICT = (options) =>
  `single slot "${options.name}" already has a registration at priority ${options.priority}` +
  " (registered by mf) — register at a different priority to shadow it (lowest renders)";

// ---- minimal DOM stub (trimmed from runtime-effects.test.mjs) ---------------

function makeNode(tag) {
  return {
    tagName: tag,
    children: [],
    parentElement: null,
    dataset: {},
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
    append(child) { this.appendChild(child); },
    remove() {
      if (this.parentElement !== null) {
        const index = this.parentElement.children.indexOf(this);
        if (index >= 0) this.parentElement.children.splice(index, 1);
      }
    },
    querySelectorAll(selector) {
      const rel = /link\[rel="(icon|shortcut icon)"\]/.test(selector);
      return this.children.filter((child) => rel && child.tagName === "link");
    },
    querySelector(selector) {
      const match = /style\[data-plugin-css="(.+)"\]/.exec(selector);
      if (match === null) return null;
      return this.children.find((child) => child.tagName === "style" && child.dataset.pluginCss === match[1]) ?? null;
    },
  };
}

function installDom() {
  const head = makeNode("head");
  const body = makeNode("body");
  const storage = new Map();
  globalThis.document = {
    head,
    body,
    title: "DeepSeek Harness",
    createElement: (tag) => makeNode(tag),
    querySelector: (selector) => head.querySelector(selector),
  };
  globalThis.window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { search: "" },
  };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
  };
}

// ---- harness ----------------------------------------------------------------

const stubJsx = { jsx: () => null };

function withLegacyAssets(skin) {
  if (skin.builtinAssets === undefined) {
    skin.builtinAssets = { art: { mime: "image/webp", url: skin.art !== "" ? skin.art : skin.placeholderLight } };
  }
  return skin;
}

function personalizationFor(skinsById) {
  return {
    getOverrides: () => ({}),
    assetResolver: (ref) => {
      if (ref.kind === "builtin") {
        const asset = skinsById.get(ref.skinId)?.builtinAssets?.[ref.assetKey];
        return asset ? { url: asset.url, mime: asset.mime } : null;
      }
      return null;
    },
  };
}

/** Slots stub with a realistic single-slot ledger the skin can probe. */
function makeLedgerSlots() {
  const ledger = new Map();
  const helpers = {
    seat(name, priority) {
      const list = ledger.get(name) ?? [];
      list.push({ options: { name, priority } });
      ledger.set(name, list);
    },
  };
  const slots = {
    ...helpers,
    inject: (key, callback) => callback() ?? (() => {}),
    entries: (name) => [...(ledger.get(name) ?? [])],
    register(options) {
      const priority = options.priority ?? 0;
      if ((ledger.get(options.name) ?? []).some((entry) => (entry.options.priority ?? 0) === priority)) {
        throw new Error(CONFLICT({ ...options, priority }));
      }
      helpers.seat(options.name, priority);
      const entry = { options: { name: options.name, priority } };
      return () => {
        const list = ledger.get(options.name) ?? [];
        ledger.set(options.name, list.filter((candidate) => candidate !== entry));
      };
    },
  };
  return slots;
}

function bootRuntime(ctx) {
  const runtime = createSkinRuntime();
  const openbmc = withLegacyAssets(createOpenBmcHarness(stubJsx));
  runtime.register(openbmc);
  runtime.setPersonalization(personalizationFor(new Map([["openbmc", openbmc]])));
  const dispose = runtime.apply(ctx); // apply() mounts order[0]
  return { runtime, dispose };
}

test.afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.CustomEvent;
  delete globalThis.MutationObserver;
  delete globalThis.localStorage;
});

test("brand seats claim the deep -20 base, never the third-party magnet -10", () => {
  installDom();
  const captured = [];
  const ctx = {
    slots: {
      inject: (key, callback) => callback() ?? (() => {}),
      register: (options) => { captured.push({ ...options }); return () => {}; },
    },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  const { runtime } = bootRuntime(ctx);
  const brand = captured.filter((options) => BRAND_SLOTS.includes(options.name));
  assert.equal(brand.length, 3);
  for (const options of brand) {
    assert.equal(options.priority, -20, `${options.name} must sit below the -10 magnet`);
  }
  assert.notEqual(runtime.active(), "official");
});

test("an occupant at the -10 magnet leaves -20 free; an occupant at -20 pushes us to -21", () => {
  installDom();
  const captured = [];
  const slots = makeLedgerSlots();
  slots.seat("sidebar.brand.mark", -10);
  slots.seat("sidebar.brand.name", -10);
  slots.seat("conversation.hero.brand.mark", -10);
  const base = {
    slots: { ...slots, register: (options) => { captured.push({ ...options }); return slots.register(options); } },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  bootRuntime(base);
  assert.deepEqual(
    captured.filter((options) => BRAND_SLOTS.includes(options.name)).map((options) => options.priority),
    [-20, -20, -20],
  );

  const captured2 = [];
  const slots2 = makeLedgerSlots();
  slots2.seat("sidebar.brand.mark", -20);
  slots2.seat("sidebar.brand.name", -20);
  slots2.seat("conversation.hero.brand.mark", -20);
  const deep = {
    slots: { ...slots2, register: (options) => { captured2.push({ ...options }); return slots2.register(options); } },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  bootRuntime(deep);
  assert.deepEqual(
    captured2.filter((options) => BRAND_SLOTS.includes(options.name)).map((options) => options.priority),
    [-21, -21, -21],
  );
});

test("a racing equal-priority conflict retries one seat deeper and wins", () => {
  installDom();
  const slots = makeLedgerSlots();
  const attempted = [];
  const racers = new Set(BRAND_SLOTS); // one racer per slot wins the seat we probed a moment ago
  const racing = {
    slots: {
      inject: slots.inject,
      entries: slots.entries,
      register: (options) => {
        if (racers.has(options.name)) {
          racers.delete(options.name);
          slots.seat(options.name, options.priority); // the racer takes exactly our seat
          attempted.push([options.name, options.priority]);
          throw new Error(CONFLICT(options));
        }
        attempted.push([options.name, options.priority]);
        return slots.register(options);
      },
    },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  const { runtime } = bootRuntime(racing);
  // Every slot's ladder is [-20 (stolen), -21 (ours)] — strictly deeper, then success.
  const bySlot = Object.fromEntries(BRAND_SLOTS.map((name) => [
    name,
    attempted.filter(([slot]) => slot === name).map(([, priority]) => priority),
  ]));
  for (const name of BRAND_SLOTS) {
    assert.deepEqual(bySlot[name], [-20, -21], `${name} ladder`);
  }
  assert.notEqual(runtime.active(), "official", "skin must stay mounted after winning the retries");
});

test("an always-contested seat is yielded; the skin still mounts", () => {
  installDom();
  const slots = makeLedgerSlots();
  const attempted = [];
  const hostile = {
    slots: {
      inject: slots.inject,
      entries: slots.entries,
      register: (options) => {
        attempted.push([options.name, options.priority]);
        slots.seat(options.name, options.priority);
        throw new Error(CONFLICT(options));
      },
    },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  const { runtime } = bootRuntime(hostile);
  for (const name of BRAND_SLOTS) {
    const ladder = attempted.filter(([slot]) => slot === name).map(([, priority]) => priority);
    assert.deepEqual(ladder, [-20, -21, -22, -23], `${name} bounded ladder`);
  }
  assert.notEqual(runtime.active(), "official", "a lost cosmetic seat must not fail the mount");
});

test("unknown register errors still fail the mount loudly (fall back to official)", () => {
  installDom();
  const ctx = {
    slots: {
      inject: (key, callback) => callback() ?? (() => {}),
      register: () => { throw new Error('slot "sidebar.brand.mark" is not declared'); },
    },
    locale: { getLocale: () => ({ active: "zh" }), dicts: new Map() },
    theme: { overrideTokens: () => () => {} },
  };
  const { runtime } = bootRuntime(ctx);
  assert.equal(runtime.active(), "official", "non-conflict errors keep the loud fallback path");
});
