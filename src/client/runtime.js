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
  "// dsh-skins shell-frame single-paint alignment (ADR-0009)",
  'html[data-windows-titlebar] [class*="_frame"]:has(> [class*="_sidebarCol"])::before{background:0 0}',
  'html[data-windows-titlebar] [class*="_frame"] > [class*="_sidebarCol"]{background:0 0}',
  'html[data-windows-titlebar] [class*="_sidebarCol"] > [class*="_root"]{background:0 0}',
].join("\n");

// -- Windows caption probe alignment (ADR-0009 v2) ---------------------------
// The win32 preload paints the native caption-button overlay (WCO) with the
// computed backgroundColor of a hidden probe span it appends to the body,
// styled `background-color:var(--dsw-specific-sidebar-fill)`, and re-sends on
// every head/style/`data-ds-dark-theme` mutation (its own dedupe + ipc loop).
// A translucent skin fill reaches that native surface without its wallpaper
// backdrop, so the buttons render as an opaque rectangle in the fill's base
// color. Feed the probe the OPAQUE composite of the fill over the wallpaper's
// top-right region instead: a stylesheet `!important` beats the probe's
// inline declaration, the preload observer picks the change up automatically,
// and removing the style tag reverts to the host fallback. The composite is
// correct whether the platform honors or ignores overlay alpha, because the
// emitted color is always fully opaque. The probe hook is structural
// (`span[style*="--dsw-specific-sidebar-fill"]`) but lives in the desktop
// preload, not in the scanned runtime — a preload rework shows up as a visual
// regression, re-derive there (no static guard possible).
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
    "// dsh-skins caption probe alignment (ADR-0009 v2)",
    `body:not([data-ds-dark-theme]) > ${CAPTION_PROBE_SELECTOR}{background-color:${composites.light}!important}`,
    `body[data-ds-dark-theme] > ${CAPTION_PROBE_SELECTOR}{background-color:${composites.dark}!important}`,
  ].join("\n");
}

// The buttons sample the wallpaper where they sit (top-right); a 32px
// thumbnail approximates the runtime's blur, which preserves the local mean.
const CAPTION_SAMPLE_SIZE = 32;
const backdropSampleCache = new Map(); // url -> Promise<{r,g,b}|null>

async function sampleBackdropTopRight(url) {
  if (typeof Image === "undefined") return null;
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    return null; // broken/cross-tainted asset: fail closed, no override
  }
  const canvas = document.createElement("canvas");
  canvas.width = CAPTION_SAMPLE_SIZE;
  canvas.height = CAPTION_SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(image, 0, 0, CAPTION_SAMPLE_SIZE, CAPTION_SAMPLE_SIZE);
  const x0 = Math.round(CAPTION_SAMPLE_SIZE * 0.6);
  const height = Math.round(CAPTION_SAMPLE_SIZE * 0.3);
  const width = CAPTION_SAMPLE_SIZE - x0;
  const region = context.getImageData(x0, 0, width, height).data;
  let r = 0, g = 0, b = 0;
  const pixels = region.length / 4;
  for (let index = 0; index < region.length; index += 4) {
    r += region[index];
    g += region[index + 1];
    b += region[index + 2];
  }
  return { r: Math.round(r / pixels), g: Math.round(g / pixels), b: Math.round(b / pixels) };
}

function sampleBackdropCached(url) {
  if (backdropSampleCache.size > 8) backdropSampleCache.clear();
  if (!backdropSampleCache.has(url)) backdropSampleCache.set(url, sampleBackdropTopRight(url));
  return backdropSampleCache.get(url);
}

async function alignCaptionProbe(effects, tag) {
  try {
    const fills = effects.tokenOverrides?.["--dsw-specific-sidebar-fill"] ?? null;
    if (fills === null) return;
    const lightFill = parseRgbaChannels(fills.light);
    const darkFill = parseRgbaChannels(fills.dark);
    if (lightFill === null || darkFill === null) return;
    const imageLight = effects.backdrop?.imageLight ?? null;
    const imageDark = effects.backdrop?.imageDark ?? null;
    if (imageLight === null || imageDark === null) return;
    const [lightBackdrop, darkBackdrop] = await Promise.all([
      sampleBackdropCached(imageLight),
      sampleBackdropCached(imageDark),
    ]);
    if (lightBackdrop === null || darkBackdrop === null) return;
    // Commit atomically: both modes resolved, else the empty tag stays a no-op.
    tag.textContent = buildCaptionCss({
      light: compositeOverBackdrop(lightFill, lightBackdrop),
      dark: compositeOverBackdrop(darkFill, darkBackdrop),
    });
  } catch {
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

      // Windows caption probe alignment (ADR-0009 v2): the probe and its ipc
      // loop only exist under the win32 preload, keyed by the same public
      // marker. The tag is created empty and filled asynchronously by the
      // wallpaper sampler — a failed sample keeps the empty no-op, removal
      // reverts the overlay to the host fallback through the preload observer.
      if (typeof document !== "undefined"
        && document.documentElement?.hasAttribute?.("data-windows-titlebar") === true) {
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
