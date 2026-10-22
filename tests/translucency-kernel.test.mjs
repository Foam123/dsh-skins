/**
 * translucency.js kernel unit tests (ADR-0013, plan Task 2) — synthetic
 * tables only; the real skins are covered by translucency-contract tests.
 * Byte formats under pin: rgba "R, G, B" comma-space + two-decimal leading-
 * zero alpha; overlay scrim three decimals; single-line glass rule.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createProjection, glassRule } from "../src/client/skins/translucency.js";
import { normalizeEffects } from "../src/client/personalization/projector.js";

const USER_REF = "u_0123456789abcdef0123456789abcdef";

const legacyTable = {
  bodyAttribute: "dshSyntheticSkin",
  titleBrand: "Synthetic",
  favicon: { href: "data:image/svg+xml,x", mime: "image/svg+xml" },
  anchor: 20,
  riding: {
    "--syn-low": { light: ["1, 2, 3", 10], dark: ["4, 5, 6", 70] },
    "--syn-high": { light: ["7, 8, 9", 40], dark: ["10, 11, 12", 90] },
  },
  constantTokens: { "--syn-const": { light: "#fff", dark: "#000" } },
  scrim: {
    kind: "baked-gradient",
    stops: {
      light: [["1, 2, 3", 15], ["4, 5, 6", 25]],
      dark: [["7, 8, 9", 5], ["10, 11, 12", 35]],
    },
    artLayer: ', url("data:image/webp;base64,SYN")',
  },
  blur: { max: 10 },
  glassVar: "--syn-glass-blur",
  desktopBlur: { rate: 50, dark: "none" },
  wallpaper: { kind: "legacy-baked", sentinel: "builtin:synthetic:art", placeholder: { light: "PH-L", dark: "PH-D" } },
  staticCss: "/*synthetic*/",
};

const overlayTable = {
  bodyAttribute: "dshOverlaySkin",
  titleBrand: "Overlay",
  favicon: { href: "data:image/webp;base64,X", mime: "image/webp" },
  anchor: 35,
  riding: { "--ov-base": { light: ["250, 249, 246", 35], dark: ["18, 18, 26", 45] } },
  constantTokens: null,
  scrim: { kind: "overlay", coefficient: 30, light: "252, 250, 246", dark: "16, 16, 26" },
  blur: { max: 12 },
  glassVar: "--ov-glass-blur",
  desktopBlur: { rate: 55, dark: "boost" },
  wallpaper: { kind: "assets" },
  staticCss: "/*overlay*/",
};

const legacy = createProjection(legacyTable);
const overlay = createProjection(overlayTable);

test("riding rebase: pivot math with both-side clamp and two-decimal formatting", () => {
  const fx = legacy({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null);
  assert.equal(fx.tokenOverrides["--syn-low"].light, "rgba(1, 2, 3, 0.90)", "baked<anchor: 45+baked, no clamp");
  assert.equal(fx.tokenOverrides["--syn-low"].dark, "rgba(4, 5, 6, 1.00)", "baked>anchor clamps to 1.00");
  assert.equal(fx.tokenOverrides["--syn-high"].light, "rgba(7, 8, 9, 1.00)");
  assert.equal(fx.tokenOverrides["--syn-high"].dark, "rgba(10, 11, 12, 1.00)");

  const zero = legacy({ panelOpacity: 0, slogan: { zh: "z", en: "e" } }, null);
  assert.equal(zero.tokenOverrides["--syn-low"].light, "rgba(1, 2, 3, 0.00)", "baked<anchor floors at 0.00");
  assert.equal(zero.tokenOverrides["--syn-low"].dark, "rgba(4, 5, 6, 0.50)", "baked>anchor keeps residual");
  assert.equal(zero.tokenOverrides["--syn-high"].light, "rgba(7, 8, 9, 0.20)");

  const anchor = legacy({ panelOpacity: 20, slogan: { zh: "z", en: "e" } }, null);
  assert.equal(anchor.tokenOverrides["--syn-low"].light, "rgba(1, 2, 3, 0.10)", "P=anchor reproduces baked verbatim");
});

test("constant tokens merge alongside riding", () => {
  const fx = legacy({ panelOpacity: 20, slogan: { zh: "z", en: "e" } }, null);
  assert.deepEqual(fx.tokenOverrides["--syn-const"], { light: "#fff", dark: "#000" });
  assert.deepEqual(Object.keys(fx.tokenOverrides).sort(), ["--syn-const", "--syn-high", "--syn-low"]);
  const ov = overlay({ panelOpacity: 35, slogan: { zh: "z", en: "e" } }, null);
  assert.deepEqual(Object.keys(ov.tokenOverrides), ["--ov-base"], "null constantTokens adds nothing");
});

test("blur curve: hinged at anchor, quadratic to max, Math.round", () => {
  assert.equal(legacy({ panelOpacity: 20, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 0, "zero at anchor");
  assert.equal(legacy({ panelOpacity: 0, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 0, "zero below anchor");
  assert.equal(legacy({ panelOpacity: 60, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 3, "10·(40/80)²=2.5 rounds to 3");
  assert.equal(legacy({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 10, "max at P=100");
  assert.equal(overlay({ panelOpacity: 35, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 0);
  assert.equal(overlay({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null).backdrop.blur, 12);
});

test("desktopBlur: shared boost rate, cap 24, dark:none keeps plain blurPx", () => {
  const fx = legacy({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null);
  assert.deepEqual(fx.backdrop.desktopBlur, { light: 10 + 100 / 50, dark: 10 }, "rate 50 boost, dark none");
  const capped = overlay({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null);
  assert.deepEqual(capped.backdrop.desktopBlur, { light: 12 + 100 / 55, dark: 12 + 100 / 55 }, "rate 55 both modes");
  const big = createProjection({ ...legacyTable, desktopBlur: { rate: 1, dark: "boost" }, anchor: 0 });
  assert.deepEqual(
    big({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null).backdrop.desktopBlur,
    { light: 24, dark: 24 },
    "boost caps at 24",
  );
});

test("baked-gradient scrim: rebased stops + artLayer suffix, all three wallpaper branches", () => {
  const slogan = { zh: "z", en: "e" };
  const fx = legacy({ panelOpacity: 20, slogan }, null);
  assert.equal(
    fx.backdrop.imageLight,
    'linear-gradient(rgba(1, 2, 3, 0.15) 0%, rgba(4, 5, 6, 0.25) 100%), url("data:image/webp;base64,SYN")',
    "P=anchor reproduces baked scrim verbatim + artLayer",
  );
  assert.equal(
    fx.backdrop.imageDark,
    'linear-gradient(rgba(7, 8, 9, 0.05) 0%, rgba(10, 11, 12, 0.35) 100%), url("data:image/webp;base64,SYN")',
  );

  const custom = legacy({ panelOpacity: 20, slogan, wallpaper: USER_REF }, { wallpaper: { url: "data:image/webp;base64,USER" } });
  assert.equal(custom.backdrop.imageLight, 'url("data:image/webp;base64,USER")', "user image: bare url, scrim withheld");
  assert.equal(custom.backdrop.imageDark, 'url("data:image/webp;base64,USER")');
  const sentinel = legacy({ panelOpacity: 20, slogan, wallpaper: "builtin:synthetic:art" }, null);
  assert.equal(sentinel.backdrop.imageLight, fx.backdrop.imageLight, "sentinel falls back to scrim");
  const unresolvable = legacy({ panelOpacity: 20, slogan, wallpaper: USER_REF }, null);
  assert.equal(unresolvable.backdrop.imageLight, fx.backdrop.imageLight, "user ref without url falls back to scrim");
});

test("baked-gradient with empty artLayer: placeholder branch (declared) and scrim fallback (undeclared)", () => {
  const slogan = { zh: "z", en: "e" };
  const withPh = createProjection({
    ...legacyTable,
    scrim: { ...legacyTable.scrim, artLayer: "" },
  });
  const ph = withPh({ panelOpacity: 20, slogan }, null);
  assert.equal(ph.backdrop.imageLight, "PH-L", "empty art + declared placeholder");
  assert.equal(ph.backdrop.imageDark, "PH-D");

  const noPh = createProjection({
    ...legacyTable,
    scrim: { ...legacyTable.scrim, artLayer: "" },
    wallpaper: { kind: "legacy-baked", sentinel: "builtin:synthetic:art", placeholder: null },
  });
  const scrim = noPh({ panelOpacity: 20, slogan }, null);
  assert.equal(scrim.backdrop.imageLight, "linear-gradient(rgba(1, 2, 3, 0.15) 0%, rgba(4, 5, 6, 0.25) 100%)");
  assert.equal(scrim.backdrop.imageDark, "linear-gradient(rgba(7, 8, 9, 0.05) 0%, rgba(10, 11, 12, 0.35) 100%)");
});

test("overlay mode: image strictly from assets, scrim on the overlay channel, 3-decimal s", () => {
  const slogan = { zh: "z", en: "e" };
  const withAsset = overlay({ panelOpacity: 66, slogan }, { wallpaper: { url: "data:image/webp;base64,AA" } });
  assert.equal(withAsset.backdrop.imageLight, 'url("data:image/webp;base64,AA")');
  assert.equal(withAsset.backdrop.imageDark, 'url("data:image/webp;base64,AA")');
  assert.equal(withAsset.backdrop.overlayLight, "linear-gradient(rgba(252, 250, 246, 0.130) 0%, rgba(252, 250, 246, 0.130) 100%)");
  assert.equal(withAsset.backdrop.overlayDark, "linear-gradient(rgba(16, 16, 26, 0.130) 0%, rgba(16, 16, 26, 0.130) 100%)");
  const noAsset = overlay({ panelOpacity: 35, slogan }, null);
  assert.equal(noAsset.backdrop.imageLight, null, "no asset → null image, overlay still ships");
  assert.equal(noAsset.backdrop.overlayLight, "linear-gradient(rgba(252, 250, 246, 0.040) 0%, rgba(252, 250, 246, 0.040) 100%)");
  assert.equal(overlay({ panelOpacity: 0, slogan }, null).backdrop.overlayLight, "linear-gradient(rgba(252, 250, 246, 0.000) 0%, rgba(252, 250, 246, 0.000) 100%)");
});

test("glass hinge: cssVariables + single-line rule appended with \\n only above the hinge", () => {
  const slogan = { zh: "z", en: "e" };
  const below = legacy({ panelOpacity: 20, slogan }, null);
  assert.equal(below.cssVariables, null);
  assert.equal(below.staticCss, "/*synthetic*/");
  const above = legacy({ panelOpacity: 100, slogan }, null);
  assert.deepEqual(above.cssVariables, { "--syn-glass-blur": { light: "10px", dark: "10px" } });
  assert.equal(
    above.staticCss,
    '/*synthetic*/\nbody[data-dsh-synthetic-skin] [id="root"]{backdrop-filter:blur(var(--syn-glass-blur,0px))}',
  );
});

test("assembly: bodyAttribute/titleBrand/favicon passthrough, slogans from values (no fallback), decorations null", () => {
  const slogan = { zh: "中", en: "en" };
  const fx = legacy({ panelOpacity: 20, slogan }, null);
  assert.equal(fx.bodyAttribute, "dshSyntheticSkin");
  assert.equal(fx.titleBrand, "Synthetic");
  assert.deepEqual(fx.favicon, { href: "data:image/svg+xml,x", mime: "image/svg+xml" });
  assert.equal(fx.slogans, slogan);
  assert.equal(fx.decorations, null);
  const missing = legacy({ panelOpacity: 20 }, null);
  assert.equal(missing.slogans, undefined, "no ?? fallback — B14: mergeValues owns the default");
});

test("draft passes normalizeEffects; missing slogan normalizes to null slogans", () => {
  const ok = normalizeEffects(legacy({ panelOpacity: 100, slogan: { zh: "z", en: "e" } }, null));
  assert.notEqual(ok, null);
  assert.equal(Object.isFrozen(ok), true);
  assert.equal(ok.backdrop.blur, 10);
  const noSlogan = normalizeEffects(legacy({ panelOpacity: 20 }, null));
  assert.notEqual(noSlogan, null);
  assert.equal(noSlogan.slogans, null);
});

test("glassRule: camelCase body attribute → data-kebab scope, single line", () => {
  assert.equal(
    glassRule("dshOpenbmcSkin", "--dsh-openbmc-glass-blur"),
    'body[data-dsh-openbmc-skin] [id="root"]{backdrop-filter:blur(var(--dsh-openbmc-glass-blur,0px))}',
  );
  assert.equal(
    glassRule("dshMeirenzhiSkin", "--dsh-mrz-glass-blur"),
    'body[data-dsh-meirenzhi-skin] [id="root"]{backdrop-filter:blur(var(--dsh-mrz-glass-blur,0px))}',
  );
  assert.equal(
    glassRule("dshUefiHarness", "--dsh-uefi-glass-blur"),
    'body[data-dsh-uefi-harness] [id="root"]{backdrop-filter:blur(var(--dsh-uefi-glass-blur,0px))}',
  );
});
