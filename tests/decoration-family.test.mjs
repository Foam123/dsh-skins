/**
 * 装饰族 golden 与等价断言（ADR-0016）：decorationCss 的 canonical 字节 =
 * meirenzhi 收拢前的手抄行（tests/meirenzhi-skin.test.mjs 既有 golden 零改动
 * 通过是判据）；同 palette 下三皮输出仅 scope 异；palette 注入直达描边与投影。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BUBBLE_HOOKS, decorationCss, badgeCss, rootClear } from "../src/client/skins/decoration.js";

const MRZ_SCOPE = "body[data-dsh-meirenzhi-skin]";
const MRZ_PALETTE = { light: "184, 67, 63", dark: "229, 138, 128" };

test("decorationCss: meirenzhi palette reproduces the shipped golden bytes (canonical)", () => {
  const css = decorationCss(MRZ_SCOPE, MRZ_PALETTE);
  assert.ok(css.includes(
    `${MRZ_SCOPE} :is([class*="Sixlwa_bubble"], [class*="userStack"] > [class*="_bubble"]){border:1px solid rgba(184, 67, 63, 0.38);box-shadow:0 1px 4px rgba(184, 67, 63, 0.10)}`,
  ), "chat light golden");
  assert.ok(css.includes(
    `${MRZ_SCOPE}[data-ds-dark-theme] :is([class*="Sixlwa_bubble"], [class*="userStack"] > [class*="_bubble"]){border-color:rgba(229, 138, 128, 0.38);box-shadow:0 1px 6px rgba(229, 138, 128, 0.10)}`,
  ), "chat dark golden");
  assert.ok(css.includes(
    `${MRZ_SCOPE} :is([class*="oRe1gG_bubble"], [class*="_stack"] > [class*="_bubble"]){border:1px solid rgba(184, 67, 63, 0.38);box-shadow:0 1px 4px rgba(184, 67, 63, 0.10)}`,
  ), "goal light golden");
  assert.ok(css.includes(
    `${MRZ_SCOPE}[data-ds-dark-theme] :is([class*="oRe1gG_bubble"], [class*="_stack"] > [class*="_bubble"]){border-color:rgba(229, 138, 128, 0.38);box-shadow:0 1px 6px rgba(229, 138, 128, 0.10)}`,
  ), "goal dark golden");
});

test("decorationCss: same palette across skins differs only in scope (three-skin equivalence)", () => {
  const meirenzhi = decorationCss(MRZ_SCOPE, MRZ_PALETTE);
  const openbmc = decorationCss("body[data-dsh-openbmc-skin]", MRZ_PALETTE);
  const uefi = decorationCss("body[data-dsh-uefi-harness]", MRZ_PALETTE);
  const normalize = (css, scope) => css.split(scope).join("«S»");
  assert.equal(
    normalize(meirenzhi, MRZ_SCOPE),
    normalize(openbmc, "body[data-dsh-openbmc-skin]"),
    "meirenzhi ↔ openbmc identical modulo scope",
  );
  assert.equal(
    normalize(meirenzhi, MRZ_SCOPE),
    normalize(uefi, "body[data-dsh-uefi-harness]"),
    "meirenzhi ↔ uefi identical modulo scope",
  );
});

test("decorationCss: palette injection reaches border and both shadow stages", () => {
  const css = decorationCss("body[x]", { light: "1, 2, 3", dark: "4, 5, 6" });
  assert.ok(css.includes("rgba(1, 2, 3, 0.38)"), "light border alpha");
  assert.ok(css.includes("rgba(1, 2, 3, 0.10)"), "light shadow alpha");
  assert.ok(css.includes("rgba(4, 5, 6, 0.38)"), "dark border alpha");
  assert.ok(css.includes("rgba(4, 5, 6, 0.10)"), "dark shadow alpha");
  assert.ok(!css.includes("184, 67, 63"), "no palette leakage");
});

test("BUBBLE_HOOKS: the single source of the pinned hashes (guard + skins consume this)", () => {
  assert.equal(BUBBLE_HOOKS.chat.exact, "Sixlwa_bubble");
  assert.equal(BUBBLE_HOOKS.chat.container, "userStack");
  assert.equal(BUBBLE_HOOKS.goal.exact, "oRe1gG_bubble");
  assert.equal(BUBBLE_HOOKS.goal.container, "_stack");
  assert.equal(BUBBLE_HOOKS.bubbleLocal, "_bubble");
});

test("badgeCss: meirenzhi output reproduces the shipped golden bytes (canonical)", () => {
  const css = badgeCss(MRZ_SCOPE, ".dsh-mrz-badge",
    { light: { bg: "#12121A", fg: "#FAF9F6" }, dark: { bg: "#FAF9F6", fg: "#12121A" } },
    { lineHeight: "16px", fontWeight: 600 });
  assert.ok(css.includes(
    `${MRZ_SCOPE} .dsh-mrz-badge{display:inline-flex;align-items:center;background:#12121A;border-radius:4px;padding:0 5px;font-size:10px;line-height:16px;font-weight:600;letter-spacing:.08em;color:#FAF9F6}`,
  ), "badge light golden");
  assert.ok(css.includes(
    `${MRZ_SCOPE}[data-ds-dark-theme] .dsh-mrz-badge{background:#FAF9F6;color:#12121A}`,
  ), "badge dark golden (pinned by tests/meirenzhi-skin.test.mjs:49 too)");
});

test("badgeCss: openbmc output carries the same declaration pairs as the retired ④b block (canon equivalence)", () => {
  const css = badgeCss("body[data-dsh-openbmc-skin]", ".dsh-openbmc-badge",
    { light: { bg: "#14202B", fg: "#F7FAFC" }, dark: { bg: "#F7FAFC", fg: "#14202B" } },
    { lineHeight: "14px", fontWeight: 650 });
  const pairs = (ruleBody) => ruleBody.split(/(?<=;)/).map((d) => d.trim().replace(/;$/, "")).filter(Boolean).sort();
  const light = css.split("{")[1]?.split("}")[0] ?? "";
  const dark = css.split("{")[2]?.split("}")[0] ?? "";
  assert.deepEqual(pairs(light), [
    "align-items:center", "background:#14202B", "border-radius:4px", "color:#F7FAFC",
    "display:inline-flex", "font-size:10px", "font-weight:650", "letter-spacing:.08em",
    "line-height:14px", "padding:0 5px",
  ], "light rule keeps every ④b declaration pair");
  assert.deepEqual(pairs(dark), ["background:#F7FAFC", "color:#14202B"], "dark rule keeps the inversion pair");
});

test("rootClear: one defensive rule per scope, identical modulo scope", () => {
  const expected = `${MRZ_SCOPE} [id="root"]{background:0 0}`;
  assert.equal(rootClear(MRZ_SCOPE), expected);
  assert.equal(
    rootClear("body[data-dsh-openbmc-skin]"),
    expected.split(MRZ_SCOPE).join("body[data-dsh-openbmc-skin]"),
  );
  assert.equal(
    rootClear("body[data-dsh-uefi-harness]"),
    expected.split(MRZ_SCOPE).join("body[data-dsh-uefi-harness]"),
  );
});
