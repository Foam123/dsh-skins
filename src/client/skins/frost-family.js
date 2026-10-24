/**
 * frostFamilyCss(scope, tints) — 浮层毛玻璃家族的唯一生成器（ADR-0012）。
 *
 * tints = { frost: { light, dark }, menu: { light, dark } }，四个值为带空格的
 * "R, G, B" 字符串；tint 色值与品牌资源仍由各皮肤目录自持，本模块只承载
 * 家族配方机制。返回一个字符串：菜单三件套（明/暗）在前，随后冻层
 * ⑧→⑧b→⑧c→⑧d→⑧e 全段——它是各皮肤家族段的唯一来源：配方与选择器
 * 并集的改动只落此处（新增浮层面在 ADR-0007 清单登记后同步一处）。
 */
export function frostFamilyCss(scope, tints, options = {}) {
  const { frost, menu } = tints;
  // Opacity + blur of the floating family, from the skin's `frost` field
  // (percent). 86 / 14px are the historical配方 values, so an omitted option
  // reproduces the pre-knob output byte for byte — existing installs see no
  // visual change until the user actually moves the slider.
  const density = typeof options.frost === "number" && Number.isFinite(options.frost)
    ? Math.min(100, Math.max(0, options.frost))
    : 86;
  // Blur tracks the same knob but flattens at the top: below ~40% the pane is
  // nearly pure wallpaper and a strong blur would smear the underlying text
  // instead of hiding it; above it, blur climbs with opacity up to 22px.
  const blurPx = Math.round(14 * Math.min(1, density / 86) * (density >= 40 ? 1 : density / 40));
  return `/* 浮层毛玻璃家族（配方与选择器并集的唯一来源；裁决与修订史见 ADR-0007，单点生成见 ADR-0012）
   * 宿主 Modal（设置页各弹窗、风险确认）、dsh-m / dsh-skins / dsh-context 等
   * 插件弹层、dockkit 悬浮窗壳与宿主对话框兜底、下拉菜单面、右栏内嵌卡与
   * 提示卡的统一配方：${density}% 不透明皮肤底色 + blur(${blurPx}px) saturate(1.3) 提饱和
   * （.lc-tip 经主人两轮实测定 ${Math.min(100, density + 10)}% 特例浓度），下层内容被盖住只余柔光；
   * --dsw-mask-blur 点亮官方默认 none 的遮罩模糊，弹窗四周一并磨砂。
   * 浮层族全部为固定值，不随通透度旋钮联动。遮罩/对话框由宿主 CSS modules
   * 渲染、类名不可测 → role/aria 属性定位；.dshm-* / .dsvm-* / .lc-* /
   * .dsh-skins-pop 为各插件自有稳定类名；结构钩子 _float_ / _dialog_ 由
   * verify-upstream-hooks 钉住。1.5.1 豁免（ADR-0007 amendment）：dsh-m 截图
   * 灯箱 .dsvm-lightbox 根同带 role/aria 语义，浅色 tint 会把影院式黑遮罩染
   * 成浅毛玻璃、白色控件整体隐形（用户双模式实拍）——影院遮罩归 dsh-m 自有
   * 不变量（0.9.62 起 background !important 自持），此处 :not 双保险、语义
   * 归位。 */
  ${scope} { --dsw-menu-surface-fill: rgba(${menu.light}, 0.94); --dsw-alias-menu-group-header-fill: rgba(${menu.light}, 0.94); --dsw-specific-menu: rgba(${menu.light}, 0.94); }
  ${scope}[data-ds-dark-theme] { --dsw-menu-surface-fill: rgba(${menu.dark}, 0.94); --dsw-alias-menu-group-header-fill: rgba(${menu.dark}, 0.94); --dsw-specific-menu: rgba(${menu.dark}, 0.94); }
  ${scope} { --dsw-mask-blur: blur(10px); }
  /* The frost surface variable is this family's single hand-off with the
     projection kernel: a skin declaring frostSurface publishes
     --dsh-skins-frost-surface, which carries the complete color. The literal
     color-mix stays as the fallback so a skin can opt out by omitting it. */
  ${scope} [role="dialog"][aria-modal="true"]:not(.dsvm-lightbox),
  ${scope} .dshm-panel,
  ${scope} .dshm-compat-dialog,
  ${scope} .dshm-dshchip-tip,
  ${scope} .dsh-skins-pop {
    background: var(--dsh-skins-frost-surface, color-mix(in srgb, rgb(${frost.light}) ${density}%, transparent));
    backdrop-filter: blur(${blurPx}px) saturate(1.3);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] [role="dialog"][aria-modal="true"]:not(.dsvm-lightbox),
  ${scope}[data-ds-dark-theme] .dshm-panel,
  ${scope}[data-ds-dark-theme] .dshm-compat-dialog,
  ${scope}[data-ds-dark-theme] .dshm-dshchip-tip,
  ${scope}[data-ds-dark-theme] .dsh-skins-pop {
    background: color-mix(in srgb, rgb(${frost.dark}) ${density}%, transparent);
  }
  ${scope} .dshm-overlay,
  ${scope} .dsvm-overlay,
  ${scope} .lc-ov-backdrop,
  ${scope} .lc-modal-backdrop {
    backdrop-filter: var(--dsw-mask-blur, blur(10px));
    -webkit-backdrop-filter: var(--dsw-mask-blur, blur(10px));
  }
  ${scope} [class*="_float_"],
  ${scope} [class*="_dialog_"],
  ${scope} .dsvm-filterpop,
  ${scope} .dsvm-modalbox,
  ${scope} .dsvm-chipswrap {
    background: color-mix(in srgb, rgb(${frost.light}) ${density}%, transparent);
    backdrop-filter: blur(${blurPx}px) saturate(1.3);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] [class*="_float_"],
  ${scope}[data-ds-dark-theme] [class*="_dialog_"],
  ${scope}[data-ds-dark-theme] .dsvm-filterpop,
  ${scope}[data-ds-dark-theme] .dsvm-modalbox,
  ${scope}[data-ds-dark-theme] .dsvm-chipswrap {
    background: color-mix(in srgb, rgb(${frost.dark}) ${density}%, transparent);
  }
  ${scope} .lc-ov-card,
  ${scope} .lc-modal-card,
  ${scope} .lc-card,
  ${scope} .lc-settings-card {
    background: color-mix(in srgb, rgb(${frost.light}) ${density}%, transparent);
    backdrop-filter: blur(${blurPx}px) saturate(1.3);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] .lc-ov-card,
  ${scope}[data-ds-dark-theme] .lc-modal-card,
  ${scope}[data-ds-dark-theme] .lc-card,
  ${scope}[data-ds-dark-theme] .lc-settings-card {
    background: color-mix(in srgb, rgb(${frost.dark}) ${density}%, transparent);
  }
  ${scope} .lc-card:has(.group\\/tip:hover) {
    position: relative;
    z-index: 10;
  }
  /* Full-page plugin surfaces (the plugin market page is a plain flex column
     with NO background of its own, so the wallpaper shows straight through and
     its lists become unreadable). It is neither a dialog nor a dockkit float,
     so no hook above reaches it — give every top-level page container the same
     frost treatment. Attribute substrings keep this independent of per-build
     class hashes; the :has() anchor is the page's own header row. */
  ${scope} [data-dsh-market-root] {
    background: var(--dsh-skins-frost-surface, color-mix(in srgb, rgb(${frost.light}) ${density}%, transparent));
    backdrop-filter: blur(${blurPx}px) saturate(1.3);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.3);
    border-radius: var(--dsw-radius-lg, 12px);
  }
  ${scope}[data-ds-dark-theme] [data-dsh-market-root] {
    background: var(--dsh-skins-frost-surface, color-mix(in srgb, rgb(${frost.dark}) ${density}%, transparent));
  }
  ${scope} .lc-tip {
    background: color-mix(in srgb, rgb(${frost.light}) ${Math.min(100, density + 10)}%, transparent);
    backdrop-filter: blur(${blurPx}px) saturate(1.3);
    -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.3);
  }
  ${scope}[data-ds-dark-theme] .lc-tip {
    background: color-mix(in srgb, rgb(${frost.dark}) ${Math.min(100, density + 10)}%, transparent);
  }`;
}
