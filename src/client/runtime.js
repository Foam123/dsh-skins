import { projectSkin } from "./personalization/projector.js";

const SKIN_STORAGE_KEY = "dsh-skins:active";
const SKIN_URL_PARAM = "skin";
const OFFICIAL_SKIN_ID = "official";
const LEGACY_OFFICIAL_ALIAS = "default";
const HERO_NS = "conversation";
const HERO_KEY = "hero.headline";
const ACTIVE_EVENT = "dsh-skins:active-changed";

/** dataset camelCase → attribute name: dshMeirenzhiSkin → data-dsh-meirenzhi-skin. */
function datasetAttribute(key) {
  return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** Create the registry and single-mounted-skin runtime. */
// Windows Desktop shell-frame alignment (ADR-0009): with `data-windows-titlebar`
// the host AppFrame paints `--dsw-specific-sidebar-fill` several times on the
// caption/sidebar side (frame background + titlebar ::before + sidebar column
// + the ui-sidebar root) while the content column's 16px corner notch shows
// the frame background ONCE. Official tokens are opaque so the stacks are
// invisible; translucent skin tokens turn the notch into a wallpaper-colored
// petal (light AND dark, all skins). CSS cannot repaint the notch — the only
// uniform state reachable is single-paint: drop the caption strip's, sidebar
// column's and sidebar root's own fills and let the frame background carry
// the surface everywhere (mirroring the darwin architecture, where the host
// itself zeroes the frame and the sidebar-root backgrounds). All rules are
// gated by the public `html[data-windows-titlebar]` marker (never matches
// ordinary Web), pinned to structural css-modules local names
// (`_frame` / `_sidebarCol` / `_root`, ADR-0006/0007 doctrine) with a
// `:has(> [class*="_sidebarCol"])` anchor so only the host AppFrame matches;
// scripts/verify-upstream-hooks.mjs (#7) fails `check` when those local names
// or the painted-token line drift.
const SHELL_ALIGNMENT_CSS = [
  "/* dsh-skins shell-frame single-paint alignment (ADR-0009) */",
  'html[data-windows-titlebar] [class*="_frame"]:has(> [class*="_sidebarCol"])::before{background:0 0}',
  'html[data-windows-titlebar] [class*="_frame"] > [class*="_sidebarCol"]{background:0 0}',
  'html[data-windows-titlebar] [class*="_sidebarCol"] > [class*="_root"]{background:0 0}',
].join("\n");

// -- Windows caption probe alignment (ADR-0009 v2/v3) ------------------------
// The win32 preload paints the native caption-button overlay (WCO) with the
// computed backgroundColor of a hidden probe span it appends to the body,
// styled `background-color:var(--dsw-specific-sidebar-fill)`, and re-sends on
// every head/style/`data-ds-dark-theme` mutation (its own dedupe + ipc loop).
// A translucent skin fill reaches that native surface without its wallpaper
// backdrop, so the buttons render as an opaque rectangle in the fill's base
// color. Feed the probe the OPAQUE composite of the fill over the wallpaper's
// strip band instead: a stylesheet `!important` beats the probe's inline
// declaration, the preload observer picks the change up automatically, and
// removing the style tag reverts to the host fallback. The composite is
// correct whether the platform honors or ignores overlay alpha, because the
// emitted color is always fully opaque. v3 field fixes (CDP-verified on the
// 0.2.0-rc.2 desktop): emitted CSS must use star-star comments — CSS has no
// line comments and a leading `//` makes the parser swallow the FIRST rule
// of the block; the tag must mount unconditionally because the titlebar
// marker can appear after the skin mounts; and the sampler must reproduce
// the cover crop at the live viewport plus the skin scrim. The probe hook is
// structural (`span[style*="--dsw-specific-sidebar-fill"]`) but lives in the
// desktop preload, not in the scanned runtime — a preload rework shows up as
// a visual regression, re-derive there (no static guard possible).
const CAPTION_PROBE_SELECTOR = 'span[style*="--dsw-specific-sidebar-fill"]';

function parseRgbaChannels(value) {
  const match = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/i.exec(value ?? "");
  if (match === null) return null;
  const channels = [match[1], match[2], match[3], match[4]].map(Number);
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  const [r, g, b, a] = channels;
  return { r, g, b, a: Math.min(1, Math.max(0, a)) };
}

function compositeOverBackdrop(fill, backdrop) {
  const channel = (name) => Math.round(fill[name] * fill.a + backdrop[name] * (1 - fill.a));
  return `rgb(${channel("r")}, ${channel("g")}, ${channel("b")})`;
}

function buildCaptionCss(composites) {
  return [
    "/* dsh-skins caption probe alignment (ADR-0009 v2) */",
    `body:not([data-ds-dark-theme]) > ${CAPTION_PROBE_SELECTOR}{background-color:${composites.light}!important}`,
    `body[data-ds-dark-theme] > ${CAPTION_PROBE_SELECTOR}{background-color:${composites.dark}!important}`,
  ].join("\n");
}

// The buttons sit in the strip's top-right, so the sample is the wallpaper's
// strip band mapped through the cover transform at the CURRENT viewport (the
// art is cropped by cover, so raw-image coordinates would sample the wrong
// region), then the skin's own scrim gradient and the fill base (as the floor
// under any art alpha) are applied — reproducing exactly what the web paints
// behind the buttons. The 32px thumbnail stands in for the runtime's blur,
// which preserves the local mean.
const CAPTION_SAMPLE_WIDTH = 32;
const CAPTION_SAMPLE_HEIGHT = 12;
const backdropSampleCache = new Map(); // url -> Promise<{r,g,b}|null>

function parseScrimStops(spec) {
  const match = /^linear-gradient\(rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\s+0%,\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\s+100%\)/.exec(spec ?? "");
  if (match === null) return null;
  return {
    from: { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: Number(match[4]) },
    to: { r: Number(match[5]), g: Number(match[6]), b: Number(match[7]), a: Number(match[8]) },
  };
}

async function sampleBackdropStrip(url, fill) {
  if (typeof Image === "undefined") return null;
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    return null; // broken/cross-tainted asset: fail closed, no override
  }
  const canvas = document.createElement("canvas");
  canvas.width = CAPTION_SAMPLE_WIDTH;
  canvas.height = CAPTION_SAMPLE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  // Opaque floor in the fill's own color: any art alpha now composites over
  // the panel color instead of over whatever the native window keeps behind
  // the page.
  context.fillStyle = `rgb(${fill.r}, ${fill.g}, ${fill.b})`;
  context.fillRect(0, 0, CAPTION_SAMPLE_WIDTH, CAPTION_SAMPLE_HEIGHT);
  const viewW = typeof innerWidth === "number" ? innerWidth : 0;
  const viewH = typeof innerHeight === "number" ? innerHeight : 0;
  if (viewW > 0 && viewH > 0 && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const scale = Math.max(viewW / image.naturalWidth, viewH / image.naturalHeight);
    const offX = (image.naturalWidth * scale - viewW) / 2;
    const offY = (image.naturalHeight * scale - viewH) / 2;
    const barHeight = parseFloat((typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--dsh-windows-titlebar-height")
      : "") || "") || 40;
    context.drawImage(
      image,
      (viewW * 0.75 + offX) / scale,
      offY / scale,
      (viewW * 0.25) / scale,
      barHeight / scale,
      0, 0, CAPTION_SAMPLE_WIDTH, CAPTION_SAMPLE_HEIGHT,
    );
  } else {
    context.drawImage(image, 0, 0, CAPTION_SAMPLE_WIDTH, CAPTION_SAMPLE_HEIGHT);
  }
  return { canvas, context };
}

function averageCanvas(context, width, height) {
  const region = context.getImageData(0, 0, width, height).data;
  let r = 0, g = 0, b = 0;
  const pixels = region.length / 4;
  for (let index = 0; index < region.length; index += 4) {
    r += region[index];
    g += region[index + 1];
    b += region[index + 2];
  }
  return { r: Math.round(r / pixels), g: Math.round(g / pixels), b: Math.round(b / pixels) };
}

async function sampleBackdropCached(url, fill, scrim) {
  if (backdropSampleCache.size > 8) backdropSampleCache.clear();
  if (!backdropSampleCache.has(url)) {
    const promise = (async () => {
      const drawn = await sampleBackdropStrip(url, fill);
      if (drawn === null) return null;
      if (scrim !== null) {
        const gradient = drawn.context.createLinearGradient(0, 0, 0, CAPTION_SAMPLE_HEIGHT);
        gradient.addColorStop(0, `rgba(${scrim.from.r}, ${scrim.from.g}, ${scrim.from.b}, ${scrim.from.a})`);
        gradient.addColorStop(1, `rgba(${scrim.to.r}, ${scrim.to.g}, ${scrim.to.b}, ${scrim.to.a})`);
        drawn.context.fillStyle = gradient;
        drawn.context.fillRect(0, 0, CAPTION_SAMPLE_WIDTH, CAPTION_SAMPLE_HEIGHT);
      }
      return averageCanvas(drawn.context, CAPTION_SAMPLE_WIDTH, CAPTION_SAMPLE_HEIGHT);
    })();
    backdropSampleCache.set(url, promise);
    // A failed sample must not poison the cache: evict so a later attempt
    // (probe-mounted-late retries) can try again.
    void promise.then((value) => {
      if (value === null) backdropSampleCache.delete(url);
    }).catch(() => {});
  }
  return backdropSampleCache.get(url);
}

function findCaptionProbe() {
  if (typeof document === "undefined") return null;
  for (const span of document.querySelectorAll("body > span")) {
    if ((span.getAttribute("style") ?? "").includes("--dsw-specific-sidebar-fill")) return span;
  }
  return null;
}

async function alignCaptionProbe(effects, tag) {
  // The probe span, like the titlebar marker, is installed by the preload
  // around DOMContentLoaded and may appear AFTER the skin mounts — poll for
  // it briefly instead of a single mount-time check (the alpha.2 field
  // failure). On ordinary Web the probe never appears and the loop burns
  // ~4s of an idle async task before leaving the empty no-op tag.
  const attempts = 6;
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 750));
      if (findCaptionProbe() === null) continue;
      const fills = effects.tokenOverrides?.["--dsw-specific-sidebar-fill"] ?? null;
      if (fills === null) { tag.dataset.captionState = "no-fill-token"; return; }
      const lightFill = parseRgbaChannels(fills.light);
      const darkFill = parseRgbaChannels(fills.dark);
      if (lightFill === null || darkFill === null) { tag.dataset.captionState = "bad-fill-token"; return; }
      const imageLight = effects.backdrop?.imageLight ?? null;
      const imageDark = effects.backdrop?.imageDark ?? null;
      if (imageLight === null || imageDark === null) { tag.dataset.captionState = "no-backdrop"; return; }
      const [lightBackdrop, darkBackdrop] = await Promise.all([
        sampleBackdropCached(imageLight, lightFill, parseScrimStops(imageLight)),
        sampleBackdropCached(imageDark, darkFill, parseScrimStops(imageDark)),
      ]);
      if (lightBackdrop === null || darkBackdrop === null) continue; // transient decode failure — retry
      // Commit atomically: both modes resolved, else the empty tag stays a no-op.
      tag.textContent = buildCaptionCss({
        light: compositeOverBackdrop(lightFill, lightBackdrop),
        dark: compositeOverBackdrop(darkFill, darkBackdrop),
      });
      tag.dataset.captionState = "filled";
      return;
    }
    tag.dataset.captionState = "no-probe";
  } catch {
    tag.dataset.captionState = "failed";
    // sampling is best-effort; the empty tag is the fail-closed state
  }
}

export function createSkinRuntime() {
  const skins = new Map();
  const order = [];
  let ctx = null;
  let mounted = null; // { skin, effects, overrides, stop }
  let selectedId = null;
  let personalization = null; // { getOverrides, assetResolver, metaProvider }

  function register(skin) {
    if (!skin || typeof skin.id !== "string" || skin.id.length === 0) {
      throw new Error("[dsh-skins] every skin needs a non-empty id");
    }
    if (skin.id === OFFICIAL_SKIN_ID || skin.id === LEGACY_OFFICIAL_ALIAS) {
      throw new Error(`[dsh-skins] skin id "${skin.id}" is reserved for the official appearance`);
    }
    if (skins.has(skin.id)) throw new Error(`[dsh-skins] duplicate skin id "${skin.id}"`);
    skins.set(skin.id, skin);
    order.push(skin.id);
  }

  /** Active UI locale ("zh"|"en"); falls back to zh before apply(). */
  function activeLocale() {
    try {
      return ctx?.locale?.getLocale?.().active ?? "zh";
    } catch {
      return "zh";
    }
  }

  function localizedText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value[activeLocale()] ?? value.en ?? value.zh ?? "";
    return String(value);
  }

  function list() {
    return order.map((id) => {
      const skin = skins.get(id);
      return { id, label: localizedText(skin.label), description: localizedText(skin.description) };
    });
  }

  function normalizeChoiceId(id) {
    return id === LEGACY_OFFICIAL_ALIAS ? OFFICIAL_SKIN_ID : id;
  }

  function isKnownChoice(id) {
    return id === OFFICIAL_SKIN_ID || skins.has(id);
  }

  function resolveSelectedId() {
    try {
      const query = window.location?.search;
      const fromUrl = query ? new URLSearchParams(query).get(SKIN_URL_PARAM) : null;
      const normalizedUrl = normalizeChoiceId(fromUrl);
      if (normalizedUrl && isKnownChoice(normalizedUrl)) {
        localStorage.setItem(SKIN_STORAGE_KEY, normalizedUrl);
        return normalizedUrl;
      }
      const stored = normalizeChoiceId(localStorage.getItem(SKIN_STORAGE_KEY));
      if (stored && isKnownChoice(stored)) {
        localStorage.setItem(SKIN_STORAGE_KEY, stored);
        return stored;
      }
    } catch {}
    // Factory default (出厂皮肤): the first registered skin wins until the user
    // explicitly chooses an appearance — openbmc since v1.0.6 (Studio rebrand),
    // meirenzhi before that. Stored selections and ?skin= keep priority.
    return order[0];
  }

  function announce(id) {
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: id }));
    }
  }

  // -- personalization plumbing ----------------------------------------------

  function overridesFor(skinId) {
    try {
      return personalization?.getOverrides?.(skinId) ?? {};
    } catch {
      return {};
    }
  }

  function projectionContext() {
    return {
      assetResolver: personalization?.assetResolver,
      metaProvider: personalization?.metaProvider,
    };
  }

  // -- effects execution (transactional; design §3/§7.1) ----------------------

  function styleTag(id, content) {
    let tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`);
    if (tag === null) {
      tag = document.createElement("style");
      tag.dataset.plugin = "dsh-skins";
      tag.dataset.pluginCss = id;
      document.head.appendChild(tag);
    }
    tag.textContent = content; // reuse must never serve stale CSS
    return tag;
  }

  function backdropCss(effects) {
    const backdrop = effects.backdrop;
    if (backdrop === null) return null;
    const selector = `body[${datasetAttribute(effects.bodyAttribute)}]`;
    const darkSelector = `${selector}[data-ds-dark-theme]`;
    const rules = [];
    if (backdrop.imageLight !== null || backdrop.imageDark !== null) {
      const blur = backdrop.blur > 0
        ? `filter:blur(${backdrop.blur}px);transform:scale(1.02);`
        : "";
      rules.push(`${selector}::before{content:"";position:fixed;inset:0;z-index:-1;`
        + `background-image:${backdrop.imageLight ?? "none"};background-size:cover;`
        + `background-position:center;background-repeat:no-repeat;pointer-events:none;${blur}}`);
      if (backdrop.imageDark !== null && backdrop.imageDark !== backdrop.imageLight) {
        rules.push(`${darkSelector}::before{background-image:${backdrop.imageDark}}`);
      }
    }
    if (backdrop.overlayLight !== null || backdrop.overlayDark !== null) {
      rules.push(`${selector}::after{content:"";position:fixed;inset:0;z-index:-1;`
        + `background-image:${backdrop.overlayLight ?? "none"};pointer-events:none;}`);
      if (backdrop.overlayDark !== null && backdrop.overlayDark !== backdrop.overlayLight) {
        rules.push(`${darkSelector}::after{background-image:${backdrop.overlayDark}}`);
      }
    }
    const desktopBlur = backdrop.desktopBlur ?? null;
    if (desktopBlur !== null && (backdrop.imageLight !== null || backdrop.imageDark !== null)) {
      const desktopSelector = `html[data-windows-titlebar] ${selector}`;
      const blurDeclarations = (blur) => `filter:blur(${blur}px);transform:scale(1.02);`;
      if (desktopBlur.light === desktopBlur.dark) {
        if (desktopBlur.light > 0) {
          rules.push(`${desktopSelector}::before{${blurDeclarations(desktopBlur.light)}}`);
        }
      } else {
        if (desktopBlur.light > 0) {
          rules.push(`${desktopSelector}:not([data-ds-dark-theme])::before{${blurDeclarations(desktopBlur.light)}}`);
        }
        if (desktopBlur.dark > 0) {
          rules.push(`${desktopSelector}[data-ds-dark-theme]::before{${blurDeclarations(desktopBlur.dark)}}`);
        }
      }
    }
    return rules.length === 0 ? null : rules.join("\n");
  }


  function variablesCss(effects) {
    if (effects.cssVariables === null) return null;
    const selector = `body[${datasetAttribute(effects.bodyAttribute)}]`;
    const darkSelector = `${selector}[data-ds-dark-theme]`;
    const light = [];
    const dark = [];
    for (const [name, pair] of Object.entries(effects.cssVariables)) {
      light.push(`${name}:${pair.light}`);
      dark.push(`${name}:${pair.dark}`);
    }
    return `${selector}{${light.join(";")}}\n${darkSelector}{${dark.join(";")}}`;
  }

  /**
   * Build a skin's effects WITHOUT touching the mounted state. Every side
   * effect registers its rollback BEFORE mutating (R7): a mid-build crash
   * unwinds itself completely and the previously mounted skin keeps running.
   * Returns the unwind function; throws only after self-cleanup.
   */
  function buildEffects(skin, effects) {
    if (!ctx) throw new Error("[dsh-skins] mount before apply");
    const body = document.body;
    const stops = [];
    const unwind = () => {
      for (let index = stops.length - 1; index >= 0; index -= 1) {
        try { stops[index](); } catch {}
      }
    };

    try {
      // Slot contributions must be declaration-aware (see design history):
      // nested inject() waits for the owning UI plugins exactly like the
      // official brand plugin.
      stops.push(ctx.slots.inject("sidebar.brand.mark", () =>
        ctx.slots.inject("sidebar.brand.name", () =>
          ctx.slots.inject("conversation.hero.brand.mark", () => {
            const registrations = [
              ctx.slots.register({ name: "sidebar.brand.mark", priority: -10 }, skin.Mark),
              ctx.slots.register({ name: "sidebar.brand.name", priority: -10 }, skin.Name),
              ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -10 }, skin.Mark),
            ];
            return () => {
              for (let index = registrations.length - 1; index >= 0; index -= 1) {
                registrations[index]();
              }
            };
          })
        )
      ));

      if (effects.slogans !== null) {
        const table = ctx.locale?.dicts?.get(HERO_NS);
        const originals = [];
        if (table) {
          for (const [locale, entries] of table) {
            if (entries && entries[HERO_KEY] !== undefined) {
              originals.push([entries, entries[HERO_KEY]]);
              entries[HERO_KEY] = effects.slogans[locale] ?? effects.slogans.zh;
            }
          }
        }
        stops.push(() => {
          for (const [entries, value] of originals) entries[HERO_KEY] = value;
        });
      }

      if (effects.staticCss !== null) {
        const tag = styleTag(`dsh-skins/${skin.id}.css`, effects.staticCss);
        stops.push(() => tag.remove());
      }

      // Windows Desktop shell-frame alignment (ADR-0009): marker-scoped and
      // skin-independent, so it mounts/unmounts with the skin transaction like
      // every other emitted tag. Inert on Web (no titlebar marker) and gone
      // with `official` (unmount restores the opaque host paints).
      {
        const tag = styleTag(`dsh-skins/${skin.id}.shell.css`, SHELL_ALIGNMENT_CSS);
        stops.push(() => tag.remove());
      }

      // Windows caption probe alignment (ADR-0009 v2/v3): the tag mounts
      // UNCONDITIONALLY — the win32 preload sets the titlebar marker around
      // DOMContentLoaded, which can land AFTER the skin mounts, so gating on
      // the marker here mis-times (the 1.5.3-alpha.1 field failure). On
      // ordinary Web no probe span exists, alignCaptionProbe bails, and the
      // empty tag is an inert no-op; teardown always removes it.
      {
        const tag = styleTag(`dsh-skins/${skin.id}.caption.css`, "");
        stops.push(() => tag.remove());
        void alignCaptionProbe(effects, tag);
      }

      const backdrop = backdropCss(effects);
      if (backdrop !== null) {
        const tag = styleTag(`dsh-skins/${skin.id}.backdrop.css`, backdrop);
        stops.push(() => tag.remove());
      }

      const variables = variablesCss(effects);
      if (variables !== null) {
        const tag = styleTag(`dsh-skins/${skin.id}.vars.css`, variables);
        stops.push(() => tag.remove());
      }

      if (effects.decorations !== null) {
        for (const decoration of effects.decorations) {
          const tag = styleTag(`dsh-skins/${skin.id}.decor.${decoration.key}.css`, decoration.css);
          stops.push(() => tag.remove());
        }
      }

      if (effects.tokenOverrides !== null && typeof ctx.theme?.overrideTokens === "function") {
        const disposeTokens = ctx.theme.overrideTokens(`dsh-skins/${skin.id}`, effects.tokenOverrides);
        stops.push(disposeTokens);
      }

      // Body scope attribute: register the rollback BEFORE setting it.
      const hadAttribute = body.dataset[effects.bodyAttribute] !== undefined;
      stops.push(() => {
        if (!hadAttribute) delete body.dataset[effects.bodyAttribute];
      });
      body.dataset[effects.bodyAttribute] = "";

      if (effects.favicon !== null) {
        const removedIcons = [...document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')];
        let favicon = null;
        stops.push(() => {
          if (favicon !== null) favicon.remove();
          for (const element of removedIcons) document.head.append(element);
        });
        removedIcons.forEach((element) => element.remove());
        favicon = document.createElement("link");
        favicon.rel = "icon";
        favicon.type = effects.favicon.mime;
        favicon.href = effects.favicon.href;
        document.head.append(favicon);
      }

      // Browser chrome identity, cooperatively: rebrand only the product
      // segment and keep the session segment intact (see design history —
      // the official DocumentTitle projector rewrites ~75ms after mount).
      const officialBrand = "DeepSeek Harness";
      const brand = effects.titleBrand === null || effects.titleBrand === "" ? null : effects.titleBrand;
      let titleObserver = null;
      stops.push(() => {
        if (titleObserver !== null) {
          titleObserver.disconnect();
          if (document.title === brand) document.title = officialBrand;
          else if (brand !== null && document.title.endsWith(" — " + brand)) {
            document.title = document.title.slice(0, document.title.length - brand.length) + officialBrand;
          }
        }
      });
      if (brand !== null) {
        const withBrand = (text) => {
          if (text === officialBrand) return brand;
          if (text.endsWith(" — " + officialBrand)) return text.slice(0, text.length - officialBrand.length) + brand;
          return null; // foreign writer or already rebranded: leave untouched
        };
        const rebrand = () => {
          const next = withBrand(document.title);
          if (next !== null && next !== document.title) document.title = next;
        };
        rebrand();
        titleObserver = new MutationObserver(rebrand);
        titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
      }
    } catch (error) {
      unwind();
      throw error;
    }
    return unwind;
  }

  function unmount() {
    if (!mounted) return;
    mounted.stop();
    mounted = null;
  }

  /**
   * Teardown-first mount (N1): effects share DOM node identities (style
   * tags, token layers, dict entries), so the OLD set must be fully
   * disposed BEFORE the new one is built — otherwise the old disposers tear
   * down nodes the new set is actively using. A failed build restores the
   * previous skin by RE-PROJECTING it (the projector is pure and cheap);
   * when even that fails we fall back to official.
   */
  function applyEffects(skin, effects, overrides) {
    const previous = mounted === null ? null : { skin: mounted.skin, overrides: mounted.overrides };
    unmount(); // restores officials first: correct title/favicon baseline
    let stop;
    try {
      stop = buildEffects(skin, effects);
    } catch (error) {
      console.warn(`[dsh-skins] mounting "${skin.id}" failed`, error);
      restorePrevious(previous, error);
      return false;
    }
    mounted = { skin, effects, overrides, stop };
    selectedId = skin.id;
    announce(skin.id);
    return true;
  }

  function restorePrevious(previous, cause) {
    if (previous !== null) {
      try {
        const restored = projectSkin(previous.skin, previous.overrides, projectionContext());
        if (restored.effects !== null) {
          const stop = buildEffects(previous.skin, restored.effects);
          mounted = { skin: previous.skin, effects: restored.effects, overrides: previous.overrides, stop };
          selectedId = previous.skin.id;
          announce(previous.skin.id);
          return;
        }
      } catch (restoreError) {
        console.error("[dsh-skins] restoring the previous skin failed; falling back to official", restoreError);
      }
    }
    void cause;
    selectedId = OFFICIAL_SKIN_ID;
    announce(OFFICIAL_SKIN_ID);
  }

  /** Project + mount a skin; false = failed (previous restored or official). */
  function mountSkin(skin) {
    const overrides = overridesFor(skin.id);
    const result = projectSkin(skin, overrides, projectionContext());
    if (result.effects === null) {
      console.warn(`[dsh-skins] skin "${skin.id}" failed to project`);
      if (mounted !== null) return false; // projection failed, current skin untouched
      selectedId = OFFICIAL_SKIN_ID; // first boot fail-closed
      announce(OFFICIAL_SKIN_ID);
      return false;
    }
    if (result.degraded !== "none") {
      console.warn(`[dsh-skins] skin "${skin.id}" projected with degraded defaults (${result.degraded})`);
    }
    return applyEffects(skin, result.effects, overrides);
  }

  /**
   * Hot-update the active skin's effects after a config change. Projection
   * failures keep the current effects; mount failures re-project and
   * restore the previous overrides (design §7.1 / §3).
   */
  function updateActive() {
    if (mounted === null) return { applied: false, reason: "none" };
    const skin = mounted.skin;
    const overrides = overridesFor(skin.id);
    const result = projectSkin(skin, overrides, projectionContext());
    if (result.effects === null) {
      console.warn("[dsh-skins] config hot-update failed to project; keeping current effects");
      return { applied: false, reason: "projection-failed" };
    }
    const applied = applyEffects(skin, result.effects, overrides);
    return applied
      ? { applied: true, degraded: result.degraded }
      : { applied: false, reason: "mount-failed" };
  }

  function select(id) {
    const normalizedId = normalizeChoiceId(id);
    const skin = skins.get(normalizedId);
    if (normalizedId !== OFFICIAL_SKIN_ID && !skin) {
      throw new Error(`[dsh-skins] unknown skin "${id}" — available: ${[OFFICIAL_SKIN_ID, ...order].join(", ")}`);
    }
    if (selectedId === normalizedId && mounted !== null) return normalizedId;

    if (normalizedId === OFFICIAL_SKIN_ID) {
      unmount();
      selectedId = OFFICIAL_SKIN_ID;
      try { localStorage.setItem(SKIN_STORAGE_KEY, normalizedId); } catch {}
      announce(OFFICIAL_SKIN_ID);
      return normalizedId;
    }

    if (mountSkin(skin)) {
      try { localStorage.setItem(SKIN_STORAGE_KEY, normalizedId); } catch {}
    } else {
      console.warn(`[dsh-skins] selection of "${normalizedId}" did not take effect`);
    }
    return normalizedId;
  }

  function setPersonalization(provider) {
    personalization = provider ?? null;
    if (mounted !== null) updateActive();
  }

  function apply(nextCtx) {
    ctx = nextCtx;
    const id = resolveSelectedId();
    if (id === OFFICIAL_SKIN_ID) {
      selectedId = OFFICIAL_SKIN_ID;
    } else {
      const skin = skins.get(id) ?? skins.get(order[0]);
      if (!skin) throw new Error("[dsh-skins] no skins registered");
      if (!mountSkin(skin)) selectedId = OFFICIAL_SKIN_ID; // fail-closed first boot
    }
    return () => {
      unmount();
      selectedId = null;
    };
  }

  return {
    officialId: OFFICIAL_SKIN_ID,
    register,
    list,
    select,
    apply,
    unmount,
    updateActive,
    setPersonalization,
    active: () => selectedId,
  };
}

// Pure helpers of the caption alignment, exported for golden tests (the DOM
// stub cannot execute the Image/canvas sampling path).
export const captionAlignment = { parseRgbaChannels, compositeOverBackdrop, buildCaptionCss };
