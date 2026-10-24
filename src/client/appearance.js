/**
 * Appearance vocabulary shared by the sidebar switcher popover and the
 * Settings → Skins page: the three theme choices and their icons. Both
 * surfaces render the same official theme service, so the choice list must
 * not be duplicated (a fourth preference added in one place would silently
 * disagree with the other).
 */
export const THEME_CHOICES = [
  { id: "light", labelKey: "appearance.light" },
  { id: "dark", labelKey: "appearance.dark" },
  { id: "system", labelKey: "appearance.system" },
];

/** One theme icon element for `id` (light / dark / anything else = system). */
export function renderThemeIcon(jsx, id) {
  if (id === "light") {
    return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
      jsx("circle", { cx: "12", cy: "12", r: "4", stroke: "currentColor", strokeWidth: "1.6" }),
      jsx("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
    ] });
  }
  if (id === "dark") {
    return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: jsx("path", { d: "M20 15.2A8.2 8.2 0 0 1 8.8 4a8.2 8.2 0 1 0 11.2 11.2Z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }) });
  }
  return jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
    jsx("rect", { x: "3", y: "4", width: "18", height: "13", rx: "2.5", stroke: "currentColor", strokeWidth: "1.6" }),
    jsx("path", { d: "M8 21h8M12 17v4", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
  ] });
}
