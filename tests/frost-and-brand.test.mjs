import assert from "node:assert/strict";
import test from "node:test";
import { createMeirenzhiSkin } from "../src/client/skins/meirenzhi/index.js";
import { createOpenBmcHarness } from "../src/client/skins/openbmc-harness/index.js";
import { createUefiHarness } from "../src/client/skins/uefi-harness/index.js";
import { frostFamilyCss } from "../src/client/skins/frost-family.js";

const stubJsx = { jsx: (t, p) => ({ t, p }) };
const assets = { wallpaper: { url: "data:image/webp;base64,AA" } };
const base = { wallpaper: "builtin:meirenzhi:yuntai", titleBrand: "", slogan: { zh: "x", en: "y" }, panelOpacity: 35 };

test("titleBrand: override reaches the tab title, empty falls back to the skin title", () => {
  const skin = createMeirenzhiSkin(stubJsx);
  assert.equal(skin.project({ ...base, titleBrand: "凡人修仙传" }, assets).titleBrand, "凡人修仙传");
  assert.equal(skin.project({ ...base, titleBrand: "" }, assets).titleBrand, "美人志", "empty → skin title");
  assert.equal(skin.project({ ...base, titleBrand: "   " }, assets).titleBrand, "美人志", "whitespace → skin title");
  assert.equal(skin.project(base, assets).titleBrand, "美人志", "absent → skin title");
});

test("titleBrand: the sidebar Name component renders the custom brand", () => {
  // The regression this guards: the field persisted correctly but the sidebar
  // kept showing the hardcoded factory name, because Name() ignored props.
  const skin = createMeirenzhiSkin(stubJsx);
  const text = (node) => {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    // The stub renders { t, p } (no props wrapper); real React elements carry
    // props. Accept both so the assertion tests the COMPONENT, not the stub.
    const children = node.props?.children ?? node.p?.children;
    return children === undefined ? "" : text(children);
  };
  const custom = text(skin.Name({ brand: "Alex" }));
  assert.ok(custom.includes("Alex"), "custom brand reaches the DOM");
  assert.ok(!custom.includes("凡人修仙传"), "the factory name is replaced, not appended");

  assert.ok(text(skin.Name({})).includes("凡人修仙传"), "no prop → factory name");
  assert.ok(text(skin.Name({ brand: "" })).includes("凡人修仙传"), "empty string → factory name");
});

test("titleBrand: openbmc/uefi swap their wordmark for a custom name", () => {
  const text = (node) => {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    const children = node.props?.children ?? node.p?.children;
    return children === undefined ? "" : text(children);
  };
  // openbmc's wordmark is SVG artwork with no text in it, so the "keeps its
  // wordmark" assertion is structural (an <svg> child is still present) rather
  // than textual. uefi spells its name in text.
  const hasSvg = (node) => {
    if (node === null || node === undefined || typeof node !== "object") return false;
    if (Array.isArray(node)) return node.some(hasSvg);
    if (node.t === "svg") return true; // stub shape
    if (node.props?.children !== undefined) return hasSvg(node.props.children);
    return node.p?.children !== undefined ? hasSvg(node.p.children) : false;
  };

  for (const [factory, factoryName, factoryLabel] of [
    [createOpenBmcHarness, "OpenBMC Studio", "OpenBMC"],
    [createUefiHarness, "UEFI Studio", "UEFI"],
  ]) {
    const skin = factory(stubJsx);
    const isUefi = skin.id === "uefi-harness";

    // No prop (or the factory's own name) keeps the branded wordmark.
    assert.ok(isUefi
      ? text(skin.Name({})).includes(factoryLabel)
      : hasSvg(skin.Name({})), `${skin.id}: factory wordmark kept without a prop`);

    // A custom name replaces it — two brands never share one seat.
    const custom = text(skin.Name({ brand: "Alex" }));
    assert.ok(custom.includes("Alex"), `${skin.id}: custom name rendered`);
    assert.ok(!custom.includes(factoryLabel) || isUefi === false, `${skin.id}: wordmark replaced`);
    if (!isUefi) assert.ok(!hasSvg(skin.Name({ brand: "Alex" })), `${skin.id}: SVG wordmark dropped`);
    assert.ok(!text(skin.Name({ brand: factoryName })).includes("Alex"), `${skin.id}: factory name keeps wordmark`);
  }
});

test("titleBrand: never carries the runtime-owned separator", () => {
  const skin = createMeirenzhiSkin(stubJsx);
  const brand = skin.project({ ...base, titleBrand: "凡人修仙传" }, assets).titleBrand;
  assert.ok(!brand.includes(" — "), "the ' — ' separator belongs to the runtime, not the value");
});

test("frost: drives the floating-layer tint and blur", () => {
  const skin = createMeirenzhiSkin(stubJsx);
  const at = (frost) => skin.project({ ...base, frost }, assets).staticCss;
  // Frost surfaces are emitted as rgba() with the knob as alpha — deliberately
  // NOT color-mix(), so a computed style keeps 0-255 channels (see the Codex
  // tab-bar regression below).
  const alphas = (css) => [...new Set(
    (css.match(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/g) || [])
      .map((m) => Number(m.match(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/)[1])),
  )].sort((a, b) => a - b);

  const hi = at(100);
  const lo = at(30);
  assert.ok(alphas(hi).includes(1), "100% is fully opaque");
  assert.ok(alphas(lo).includes(0.3), "30% keeps the knob's value");
  assert.ok(alphas(hi).every((value) => value <= 1), "alpha never exceeds 1");
  assert.notEqual(hi, lo, "the knob changes the emitted CSS");
});

test("frost: full-page plugin surfaces get a surface (they ship with none)", () => {
  // The plugin manager page is a bare flex column: unlike the chat surface it
  // never painted a panel, so the wallpaper sat directly behind its lists. It
  // is neither a dialog nor a dockkit float, so the hooks above miss it.
  const tints = { frost: { light: "1, 2, 3", dark: "4, 5, 6" }, menu: { light: "1, 2, 3", dark: "4, 5, 6" } };
  const css = frostFamilyCss("body[x]", tints, { frost: 91 });

  // Both hooks are stable attributes shipped by the packages themselves, never
  // per-build class hashes.
  assert.ok(css.includes("[data-plugin-panel]"), "plugin manager page hook");
  assert.ok(css.includes("[data-dsh-market-root]"), "market page hook");
  assert.ok(css.includes(".codexSubscriptionCard"), "Codex subscription config cards are frosted too");
  // The remaining sidebar panels paint bg-base themselves but add no blur, so
  // the wallpaper stays SHARP behind their lists. Their hooks are authored
  // attributes on the page root (their classes are CSS-modules hashes).
  assert.ok(css.includes('[data-testid="task-manager-page"]'), "定时任务 panel hook");
  assert.ok(css.includes('[data-dsh-plugin="dsh-mnemon"]'), "记忆系统 panel hook");

  // The surface must actually be painted at the knob's density, and frosted.
  const idx = css.indexOf("[data-plugin-panel]");
  const block = css.slice(idx, css.indexOf("}", idx));
  assert.ok(block.includes("0.91"), "density follows the knob");
  assert.ok(block.includes("backdrop-filter"), "and it is frosted, not just tinted");
});

test("frost: 86% reproduces the pre-knob recipe byte for byte (no visual change on upgrade)", () => {
  const skin = createMeirenzhiSkin(stubJsx);
  const css = skin.project({ ...base, frost: 86 }, assets).staticCss;
  assert.ok(css.includes("rgba(250, 249, 246, 0.86)"), "86% tint");
  // The template writes "blur(14px) saturate(1.3)" — assert the value, not an
  // exact substring that also depends on the declaration's spacing.
  assert.ok(/backdrop-filter: blur\(14px\) saturate\(1\.3\)/.test(css), "14px blur");
  assert.ok(css.includes("rgba(250, 249, 246, 0.96)"), ".lc-tip keeps its +10 concentration");
});

test("frost: never emits color-mix() for a surface (0-1 float channels break samplers)", () => {
  // Regression guard for the Codex subscription tab bar. dsh-codex-subscription
  // samples the nearest painted ancestor via
  //   getComputedStyle(parent).backgroundColor.match(/[\d.]+/g)
  // and rebuilds rgb(parts[0], parts[1], parts[2]). A color-mix() computes to
  // color(srgb 0.98 0.98 0.96 / 0.91), so those parts are 0-1 floats and the
  // rebuild paints near-black — the solid black strip behind the settings tabs.
  // rgba() keeps 0-255 channels, so any such sampler stays correct.
  for (const factory of [createOpenBmcHarness, createUefiHarness, createMeirenzhiSkin]) {
    const skin = factory(stubJsx);
    const values = { ...base, panelOpacity: 55, frost: 91 };
    const fx = skin.project(values, assets);
    const css = fx.staticCss;
    assert.ok(!/background:[^;}]*color-mix/.test(css), `${skin.id}: no color-mix() surface backgrounds`);
    const surface = fx.tokenOverrides["--dsh-skins-frost-surface"];
    assert.ok(surface === undefined || Object.values(surface).every((v) => v.startsWith("rgba(")),
      `${skin.id}: the surface token is rgba() so computed channels stay 0-255`);
  }
});

test("frost: default is 86 for every skin (upgrade is a no-op)", () => {
  for (const factory of [createOpenBmcHarness, createUefiHarness]) {
    const skin = factory(stubJsx);
    const values = { ...base, panelOpacity: 55 };
    const withDefault = skin.project(values, assets).staticCss;
    const explicit = skin.project({ ...values, frost: 86 }, assets).staticCss;
    assert.equal(withDefault, explicit, `${skin.id}: absent frost equals 86`);
  }
});

test("frost: publishes a dedicated surface token that follows the knob", () => {
  // The settings dialog paints itself from a token rather than through a
  // class selector, so the knob only becomes visible there if it drives a
  // variable the dialog rule reads. It is a DEDICATED variable: openbmc/uefi
  // already ship --dsw-alias-bg-layer-2 as a translucency-riding pair that
  // the golden-table contract pins, and overwriting it would couple the two
  // knobs and break those goldens.
  const skin = createMeirenzhiSkin(stubJsx);
  const at = (frost) => skin.project({ ...base, frost }, assets).tokenOverrides["--dsh-skins-frost-surface"];
  assert.ok(at(86).light.includes("0.86"), "86% by default");
  assert.ok(at(40).light.includes("0.40"), "follows the knob down");
  assert.ok(at(40).dark.includes("0.40"), "both schemes");
  assert.ok(at(86).light.startsWith("rgba("),
    "rgba(), not color-mix(): a computed color-mix() drops to 0-1 floats and breaks backdrop samplers");
  assert.equal(
    skin.project({ ...base, frost: 40 }, assets).tokenOverrides["--dsw-alias-bg-layer-2"],
    undefined,
    "the riding token is never touched by the frost knob",
  );
});

test("frostFamilyCss: parameterised density and blur, 86/14 by default", () => {
  const tints = { frost: { light: "1, 2, 3", dark: "4, 5, 6" }, menu: { light: "1, 2, 3", dark: "4, 5, 6" } };
  const base = frostFamilyCss("body[x]", tints);
  assert.ok(base.includes("rgba(1, 2, 3, 0.86)"), "default density is the historical value");
  assert.ok(base.includes("blur(14px)"), "default blur is the historical value");

  const thin = frostFamilyCss("body[x]", tints, { frost: 20 });
  assert.ok(thin.includes("rgba(1, 2, 3, 0.20)"), "density follows the knob");
  assert.ok(!thin.includes("blur(14px)"), "blur drops with the knob");
});

test("frostFamilyCss: out-of-range input is clamped, not passed through", () => {
  const tints = { frost: { light: "1, 2, 3", dark: "4, 5, 6" }, menu: { light: "1, 2, 3", dark: "4, 5, 6" } };
  const high = frostFamilyCss("body[x]", tints, { frost: 999 });
  assert.ok(high.includes("rgba(1, 2, 3, 1.00)"), "clamped to 100");
  assert.ok(!high.includes("999"), "the raw value never reaches CSS");
  const low = frostFamilyCss("body[x]", tints, { frost: -5 });
  assert.ok(low.includes("rgba(1, 2, 3, 0.00)"), "clamped to 0");
});

test("buildStaticCss stays in sync with staticCss at the factory default", () => {
  for (const factory of [createOpenBmcHarness, createUefiHarness, createMeirenzhiSkin]) {
    const skin = factory(stubJsx);
    // staticCss is the boot literal (86); a first projection at the catalog
    // default must reproduce it so nothing shifts on load.
    const projected = skin.project(
      { wallpaper: base.wallpaper, titleBrand: "", slogan: { zh: "x", en: "y" }, panelOpacity: 55, frost: 86 },
      assets,
    ).staticCss;
    assert.equal(typeof projected, "string");
    assert.ok(/rgba\(\d+, \d+, \d+, 0\.86\)/.test(projected), `${skin.id}: 86% tint present`);
  }
});
