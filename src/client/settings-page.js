/**
 * Settings → Skins page. Registers into the official `settings.section` list
 * slot so the whole skin surface (appearance, skin choice, per-skin
 * personalization) stays reachable with the sidebar entry turned off.
 *
 * Why a settings page and not a second popover: the sidebar foot is a scarce,
 * always-visible seat the host shares with every other plugin, and the
 * placement preference (`ui.entryPlacement`) must be editable from somewhere
 * that is NOT that seat — otherwise hiding the entry would make showing it
 * again impossible.
 *
 * Data flow: placement lives in the plugin's own Host store (see
 * shared/personalization/catalog.js UI_PREFERENCES), read through the same
 * config client the personalization panel uses, so both surfaces always agree.
 */
import { renderThemeIcon, THEME_CHOICES } from "./appearance.js";

/**
 * The page's own visual interface. Composed into the plugin's single style
 * tag by the switcher (one tag per plugin — the cascade contract), so this
 * module owns the rules but never injects.
 */
export const SETTINGS_CSS = [
  ".dsh-skins-set{display:flex;flex-direction:column;gap:22px;max-width:760px;color:var(--dsw-alias-label-primary)}",
  ".dsh-skins-set-title{margin:0;font-size:18px;font-weight:600;line-height:26px}",
  ".dsh-skins-set-intro{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}",
  ".dsh-skins-set-block{display:flex;flex-direction:column;gap:10px}",
  ".dsh-skins-set-h{font-size:14px;font-weight:600;line-height:20px}",
  ".dsh-skins-set-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
  ".dsh-skins-set-error{color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-module-platform)}",
  ".dsh-skins-set-themes{display:flex;gap:8px;flex-wrap:wrap}",
  ".dsh-skins-set-theme{box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}",
  ".dsh-skins-set-theme:hover{background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsh-skins-set-theme.on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}",
  ".dsh-skins-set-theme svg{width:16px;height:16px;flex:none}",
  ".dsh-skins-set-skins{display:flex;flex-direction:column;gap:8px}",
  ".dsh-skins-set-skinrow{display:flex;align-items:stretch;gap:6px;min-width:0}",
  ".dsh-skins-set-skin{box-sizing:border-box;display:flex;flex:1;min-width:0;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}",
  ".dsh-skins-set-skin:hover{background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsh-skins-set-skin.on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform)}",
  ".dsh-skins-set-skinlabel{font-size:14px;font-weight:500;line-height:20px}",
  ".dsh-skins-set-skindesc{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
  ".dsh-skins-set-gear{flex:none;align-self:center;width:32px;height:32px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:15px;line-height:1;cursor:pointer;opacity:.75}",
  ".dsh-skins-set-gear:hover,.dsh-skins-set-gear[aria-expanded=true]{opacity:1;border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsh-skins-set-gear[aria-expanded=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}",
  ".dsh-skins-set-panel{padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-module-platform)}",
  ".dsh-skins-set-entryrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:14px 0;border-top:.5px solid var(--dsw-alias-border-l2)}",
  ".dsh-skins-set-entrytext{display:flex;flex-direction:column;gap:4px;min-width:0}",
  ".dsh-skins-set-toggle{box-sizing:border-box;position:relative;flex:none;width:40px;height:22px;padding:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l2);cursor:pointer;transition:background .12s ease}",
  ".dsh-skins-set-toggle.on{background:var(--dsw-alias-brand-primary)}",
  ".dsh-skins-set-toggle:disabled{opacity:.5;cursor:not-allowed}",
  ".dsh-skins-set-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:left .12s ease}",
  ".dsh-skins-set-toggle.on .dsh-skins-set-knob{left:20px}",
  "@media (prefers-reduced-motion:reduce){.dsh-skins-set-toggle,.dsh-skins-set-knob{transition:none}}",
].join("\n");

export function createSkinsSettingsSection({
  jsx, react, runtime, configClient, tr, PersonalizationPanel, getThemePreference, setThemePreference,
}) {
  const { useState, useEffect } = react;

  /** Subscribe to the config client (placement + write availability). */
  function useConfigState() {
    const [state, setState] = useState(() => (configClient ? configClient.getState() : null));
    useEffect(() => {
      if (!configClient) return undefined;
      return configClient.onStateChange(() => setState(configClient.getState()));
    }, []);
    return state;
  }

  function useActiveSkin() {
    const [activeId, setActiveId] = useState(() => runtime.active());
    useEffect(() => {
      if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined;
      const onChange = () => setActiveId(runtime.active());
      window.addEventListener("dsh-skins:active-changed", onChange);
      return () => window.removeEventListener("dsh-skins:active-changed", onChange);
    }, []);
    return [activeId, setActiveId];
  }

  function useThemePreference() {
    const [preference, setPreference] = useState(() => getThemePreference());
    useEffect(() => {
      const read = () => setPreference(getThemePreference());
      read();
      return undefined;
    }, []);
    return [preference, (id) => { setThemePreference(id); setPreference(id); }];
  }

  function Toggle({ on, onChange, disabled, label }) {
    return jsx("button", {
      type: "button",
      role: "switch",
      "aria-checked": on,
      "aria-label": label,
      className: `dsh-skins-set-toggle${on ? " on" : ""}`,
      disabled,
      onClick: () => onChange(!on),
      children: jsx("span", { className: "dsh-skins-set-knob" }),
    });
  }

  return function SkinsSettingsSection() {
    // Always translate through THIS plugin's namespace. The host hands slot
    // components a `t` bound to the HOST's namespace (ui-settings-general
    // binds "settings"), where none of our keys exist — trusting it would
    // render raw key names. The slot's own `locale: NS` registration is what
    // makes this lookup resolve against our dictionary.
    const t = tr;
    const state = useConfigState();
    const [activeId, setActiveId] = useActiveSkin();
    const [themePreference, setThemeChoice] = useThemePreference();
    const [personalizeId, setPersonalizeId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    // Same feedback contract as the personalization panel: auto-save is
    // silent, so a committed write flashes 已保存 instead of leaving the user
    // wondering whether the switch did anything.
    const [savedFlash, setSavedFlash] = useState(false);
    const saveTick = state?.saveTick ?? 0;
    const lastTickRef = react.useRef(saveTick);
    useEffect(() => {
      if (saveTick === lastTickRef.current) return undefined;
      lastTickRef.current = saveTick;
      setSavedFlash(true);
      const timer = setTimeout(() => setSavedFlash(false), 1600);
      return () => clearTimeout(timer);
    }, [saveTick]);

    const placement = state?.ui?.entryPlacement ?? "sidebar";
    const writesBlocked = configClient ? !configClient.canWrite() : true;
    const personalizable = configClient !== null && PersonalizationPanel !== null;

    const skins = [
      { id: runtime.officialId, label: t("skins.official.label"), description: t("skins.official.description") },
      ...runtime.list(),
    ];

    const setPlacement = async (on) => {
      if (!configClient) return;
      setSaving(true);
      setSaveError(null);
      const result = await configClient.setUiPreference("entryPlacement", on ? "sidebar" : "settings");
      setSaving(false);
      if (result?.error) setSaveError(t("settings.saveFailed"));
    };

    const themeCards = THEME_CHOICES.map((choice) => jsx("button", {
      type: "button",
      key: choice.id,
      className: `dsh-skins-set-theme${themePreference === choice.id ? " on" : ""}`,
      "aria-pressed": themePreference === choice.id,
      onClick: () => setThemeChoice(choice.id),
      children: [renderThemeIcon(jsx, choice.id), jsx("span", { children: t(choice.labelKey) })],
    }, choice.id));

    const skinRows = skins.map((skin) => {
      const isActive = activeId === skin.id;
      return jsx("div", {
        key: skin.id,
        className: "dsh-skins-set-skinrow",
        children: [
          jsx("button", {
            type: "button",
            className: `dsh-skins-set-skin${isActive ? " on" : ""}`,
            "aria-pressed": isActive,
            onClick: () => {
              runtime.select(skin.id);
              setActiveId(runtime.active());
            },
            children: [
              jsx("span", { className: "dsh-skins-set-skinlabel", children: skin.label }),
              jsx("span", { className: "dsh-skins-set-skindesc", children: skin.description }),
            ],
          }),
          personalizable ? jsx("button", {
            type: "button",
            className: "dsh-skins-set-gear",
            "aria-expanded": personalizeId === skin.id,
            "aria-label": t("personalization.title"),
            title: t("personalization.title"),
            onClick: () => {
              if (personalizeId === skin.id) {
                setPersonalizeId(null);
                return;
              }
              runtime.select(skin.id);
              setActiveId(runtime.active());
              setPersonalizeId(skin.id);
            },
            children: jsx("span", { children: "⚙" }),
          }) : null,
        ].filter(Boolean),
      });
    });

    const personalizePanel = personalizeId !== null && PersonalizationPanel !== null
      ? jsx("div", {
        key: "panel",
        className: "dsh-skins-set-panel",
        children: jsx(PersonalizationPanel, {
          skinId: personalizeId,
          onCollapse: () => setPersonalizeId(null),
        }),
      })
      : null;

    return jsx("div", {
      className: "dsh-skins-set",
      children: [
        jsx("h2", { key: "title", className: "dsh-skins-set-title", children: t("settings.title") }),
        jsx("p", { key: "intro", className: "dsh-skins-set-intro", children: t("settings.intro") }),

        jsx("section", {
          key: "appearance",
          className: "dsh-skins-set-block",
          children: [
            jsx("div", { key: "h", className: "dsh-skins-set-h", children: t("appearance.title") }),
            jsx("div", { key: "cards", className: "dsh-skins-set-themes", children: themeCards }),
          ],
        }),

        jsx("section", {
          key: "skins",
          className: "dsh-skins-set-block",
          children: [
            jsx("div", { key: "h", className: "dsh-skins-set-h", children: t("skins.title") }),
            jsx("div", { key: "rows", className: "dsh-skins-set-skins", children: skinRows }),
            personalizePanel,
          ],
        }),

        jsx("section", {
          key: "entry",
          className: "dsh-skins-set-block",
          children: [
            jsx("div", {
              key: "row",
              className: "dsh-skins-set-entryrow",
              children: [
                jsx("div", {
                  key: "text",
                  className: "dsh-skins-set-entrytext",
                  children: [
                    jsx("div", { key: "label", className: "dsh-skins-set-h", children: t("settings.entryPlacement") }),
                    jsx("div", { key: "desc", className: "dsh-skins-set-muted", children: t("settings.entryPlacement.desc") }),
                  ],
                }),
                jsx(Toggle, {
                  key: "toggle",
                  on: placement === "sidebar",
                  disabled: writesBlocked || saving,
                  label: t("settings.entryPlacement"),
                  onChange: (next) => { void setPlacement(next); },
                }),
              ],
            }),
            (saving || savedFlash) ? jsx("div", {
              key: "state",
              className: "dsh-skins-set-muted",
              role: "status",
              "aria-live": "polite",
              children: saving ? t("personalization.saving") : t("personalization.saved"),
            }) : null,
            saveError === null ? null : jsx("div", { key: "err", className: "dsh-skins-set-error", children: saveError }),
          ].filter(Boolean),
        }),
      ],
    });
  };
}
