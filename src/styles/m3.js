export const M3_COLORS = {
  light: {
    primary: "#0F5C9E",
    onPrimary: "#FFFFFF",
    primaryContainer: "#DFEEFA",
    onPrimaryContainer: "#093257",
    // Keep secondaryContainer aliased to primaryContainer to avoid competing active accents.
    secondaryContainer: "#DFEEFA",
    onSecondaryContainer: "#093257",
    tertiaryContainer: "#DCFCE7",
    onTertiaryContainer: "#14532D",
    error: "#B42318",
    errorContainer: "#FEE4E2",
    onErrorContainer: "#7A271A",
    warning: "#92400E",
    onWarning: "#FFFFFF",
    warningContainer: "#FEF3C7",
    onWarningContainer: "#5C2806",
    success: "#166534",
    successContainer: "#DCFCE7",
    onSuccessContainer: "#14532D",
    background: "#F5F6F8",
    surface: "#FFFFFF",
    surfaceLow: "#ECEFF3",
    surfaceContainer: "#E8ECF1",
    surfaceHigh: "#DFE5EC",
    surfaceHighest: "#D2DAE3",
    onSurface: "#11161D",
    onSurfaceVariant: "#4E5866",
    outline: "#727C8A",
    outlineVariant: "#D5DCE4",
    scrollbarThumb: "#768190",
    inverseSurface: "#171B21",
    onInverseSurface: "#E8EDF3",
  },
  dark: {
    primary: "#72BEF8",
    onPrimary: "#08243D",
    primaryContainer: "#133A5C",
    onPrimaryContainer: "#D6ECFE",
    secondaryContainer: "#133A5C",
    onSecondaryContainer: "#D6ECFE",
    tertiaryContainer: "#123826",
    onTertiaryContainer: "#C6F6D5",
    error: "#F8A39D",
    errorContainer: "#531B18",
    onErrorContainer: "#FEE4E2",
    warning: "#F5C15C",
    onWarning: "#3E2400",
    warningContainer: "#453008",
    onWarningContainer: "#FDE68A",
    success: "#6EE7A8",
    successContainer: "#123826",
    onSuccessContainer: "#C6F6D5",
    background: "#101317",
    surface: "#171B21",
    surfaceLow: "#1D222A",
    surfaceContainer: "#232933",
    surfaceHigh: "#2B323E",
    surfaceHighest: "#38414F",
    onSurface: "#E8EDF3",
    onSurfaceVariant: "#9AA6B5",
    outline: "#6D7888",
    outlineVariant: "#2A313C",
    scrollbarThumb: "#6D7888",
    inverseSurface: "#E8EDF3",
    onInverseSurface: "#101317",
  },
};

export function resolveM3Colors(mode = "light") {
  return {
    ...(M3_COLORS[mode] || M3_COLORS.light),
  };
}

export function resolveM3ThemeMode(mode = "auto", prefersDark = false) {
  return mode === "dark" || (mode === "auto" && prefersDark) ? "dark" : "light";
}

export function createM3CssVariables(colors) {
  return {
    "--kt-pri": colors.primary,
    "--kt-onpri": colors.onPrimary,
    "--kt-pric": colors.primaryContainer,
    "--kt-onpric": colors.onPrimaryContainer,
    "--kt-secc": colors.secondaryContainer,
    "--kt-onsecc": colors.onSecondaryContainer,
    "--kt-terc": colors.tertiaryContainer,
    "--kt-onterc": colors.onTertiaryContainer,
    "--kt-grn": colors.success,
    "--kt-grnc": colors.successContainer,
    "--kt-ongrnc": colors.onSuccessContainer,
    "--kt-warn": colors.warning,
    "--kt-onwarn": colors.onWarning,
    "--kt-warnc": colors.warningContainer,
    "--kt-onwarnc": colors.onWarningContainer,
    "--kt-err": colors.error,
    "--kt-errc": colors.errorContainer,
    "--kt-onerrc": colors.onErrorContainer,
    "--kt-bg": colors.background,
    "--kt-sf0": colors.surface,
    "--kt-sf1": colors.surfaceLow,
    "--kt-sf2": colors.surfaceContainer,
    "--kt-sf3": colors.surfaceHigh,
    "--kt-sf4": colors.surfaceHighest,
    "--kt-on": colors.onSurface,
    "--kt-onv": colors.onSurfaceVariant,
    "--kt-line": colors.outline,
    "--kt-linev": colors.outlineVariant,
    "--kt-scrollbar-thumb": colors.scrollbarThumb,
    "--kt-inv": colors.inverseSurface,
    "--kt-oninv": colors.onInverseSurface,
  };
}

export const M3_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Noto Sans CJK SC", system-ui, sans-serif';

export const M3_MONO_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// Strict 3-step body scale (15 / 14 / 13 px).
export const M3_TEXT_HEADING = 15;
export const M3_TEXT_BODY = 14;
export const M3_TEXT_SM = 13;

// Desktop motion stays inside 150-220ms with smooth ease-out and zero overshoot.
export const M3_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const M3_DURATION = "150ms";
export const M3_DURATION_SLOW = "220ms";

// Unified 4-step radius scale: 6 (sm) / 10 (control) / 12 (surface) / 16 (panel).
export const M3_RADIUS_XS = 6;
export const M3_RADIUS_SM = 6;
export const M3_RADIUS_CONTROL = 10;
export const M3_RADIUS_MD = M3_RADIUS_CONTROL;
export const M3_RADIUS_CHIP = M3_RADIUS_CONTROL;
export const M3_RADIUS_SURFACE = 12;
export const M3_RADIUS_LG = M3_RADIUS_SURFACE;
export const M3_RADIUS_CARD = M3_RADIUS_SURFACE;
export const M3_RADIUS_PANEL = 16;
export const M3_RADIUS_SHEET = M3_RADIUS_PANEL;
export const M3_RADIUS_XL = M3_RADIUS_PANEL;
export const M3_RADIUS_2XL = M3_RADIUS_PANEL;

// 4pt chrome spacing scale shared across Options, Popup, and in-page overlays.
export const M3_SPACE_2XS = 4;
export const M3_SPACE_XS = 8;
export const M3_SPACE_SM = 12;
export const M3_SPACE_MD = 16;
export const M3_SPACE_LG = 20;
export const M3_SPACE_XL = 24;
export const M3_CHROME_INSET = M3_SPACE_MD;

export const M3_GLOBAL_CSS = String.raw`
:root[data-kt-m3-root],
:host,
.kt-m3-root {
  --kt-font-sans: ${M3_FONT_FAMILY};
  --kt-font-mono: ${M3_MONO_FONT_FAMILY};
  --kt-text-heading: 0.9375rem;
  --kt-text-body: 0.875rem;
  --kt-text-sm: 0.8125rem;
  --kt-ease: ${M3_EASE};
  --kt-dur: ${M3_DURATION};
  --kt-dur-slow: ${M3_DURATION_SLOW};
  --kt-radius-xs: ${M3_RADIUS_XS}px;
  --kt-radius-sm: ${M3_RADIUS_SM}px;
  --kt-radius-control: ${M3_RADIUS_CONTROL}px;
  --kt-radius-md: ${M3_RADIUS_MD}px;
  --kt-radius-chip: ${M3_RADIUS_CHIP}px;
  --kt-radius-surface: ${M3_RADIUS_SURFACE}px;
  --kt-radius-lg: ${M3_RADIUS_LG}px;
  --kt-radius-card: ${M3_RADIUS_CARD}px;
  --kt-radius-panel: ${M3_RADIUS_PANEL}px;
  --kt-radius-sheet: ${M3_RADIUS_SHEET}px;
  --kt-radius-xl: ${M3_RADIUS_XL}px;
  --kt-radius-2xl: ${M3_RADIUS_2XL}px;
  --kt-space-2xs: ${M3_SPACE_2XS}px;
  --kt-space-xs: ${M3_SPACE_XS}px;
  --kt-space-sm: ${M3_SPACE_SM}px;
  --kt-space-md: ${M3_SPACE_MD}px;
  --kt-space-lg: ${M3_SPACE_LG}px;
  --kt-space-xl: ${M3_SPACE_XL}px;
  --kt-chrome-inset: ${M3_CHROME_INSET}px;
  --kt-border: var(--kt-linev);
  --kt-border-strong: var(--kt-line);
  --kt-scrim: rgb(17 22 29 / 0.34);
  --kt-glass-blur: blur(18px) saturate(1.4);
  --kt-glass: var(--kt-sf0);
  --kt-glass-strong: var(--kt-sf1);
  --kt-glass-bg: var(--kt-bg);
  --kt-glass-tint: var(--kt-pric);
  --kt-glass-edge: var(--kt-linev);
  --kt-liquid: var(--kt-sf0);
  --kt-liquid-tint: var(--kt-pric);
  --kt-liquid-edge: var(--kt-linev);
  --kt-liquid-blur: none;
  --kt-shadow-card: 0 1px 2px rgb(17 22 29 / 0.06), 0 4px 12px rgb(17 22 29 / 0.05);
  --kt-shadow-menu: 0 2px 6px rgb(17 22 29 / 0.08), 0 12px 32px rgb(17 22 29 / 0.12);
  --kt-shadow-border: 0 0 0 1px var(--kt-linev), 0 1px 2px rgb(17 22 29 / 0.05);
  --kt-shadow-border-hover: 0 0 0 1px var(--kt-line), 0 2px 6px rgb(17 22 29 / 0.08);
  --kt-liquid-shadow: var(--kt-shadow-menu);
  --kt-shadow-1: 0 1px 3px rgb(17 22 29 / 0.12), 0 2px 8px rgb(17 22 29 / 0.06);
  --kt-shadow-2: 0 4px 12px rgb(17 22 29 / 0.12), 0 2px 4px rgb(17 22 29 / 0.08);
  color: var(--kt-on);
  font-family: var(--kt-font-sans);
  scrollbar-color: var(--kt-scrollbar-thumb) transparent;
  scrollbar-width: auto;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Shadow DOM and isolated roots lock body steps to exact pixels so host root rem never leaks. */
:host,
.kt-m3-root[data-isolate-rem="true"] {
  --kt-text-heading: ${M3_TEXT_HEADING}px;
  --kt-text-body: ${M3_TEXT_BODY}px;
  --kt-text-sm: ${M3_TEXT_SM}px;
}

:root[data-kt-m3-root][data-theme="dark"],
:host([data-theme="dark"]),
.kt-m3-root[data-theme="dark"] {
  --kt-scrim: rgb(0 0 0 / 0.56);
  --kt-shadow-card: 0 1px 2px rgb(0 0 0 / 0.34), 0 6px 18px rgb(0 0 0 / 0.24);
  --kt-shadow-menu: 0 2px 8px rgb(0 0 0 / 0.45), 0 14px 36px rgb(0 0 0 / 0.42);
  --kt-shadow-border: 0 0 0 1px var(--kt-linev);
  --kt-shadow-border-hover: 0 0 0 1px var(--kt-line);
  --kt-shadow-1: 0 1px 3px rgb(0 0 0 / 0.48), 0 2px 8px rgb(0 0 0 / 0.34);
  --kt-shadow-2: 0 4px 14px rgb(0 0 0 / 0.48), 0 2px 4px rgb(0 0 0 / 0.42);
}

/* Subtle overlay translucency reserved strictly for top-layer floating overlays and menus. */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) and (color: color-mix(in oklab, white 50%, transparent)) {
  :root[data-kt-m3-root],
  :host,
  .kt-m3-root {
    --kt-glass: color-mix(in oklab, var(--kt-sf0) 88%, transparent);
    --kt-glass-strong: color-mix(in oklab, var(--kt-sf1) 94%, transparent);
    --kt-glass-bg: color-mix(in oklab, var(--kt-bg) 90%, transparent);
    --kt-glass-tint: color-mix(in oklab, var(--kt-pric) 86%, transparent);
    --kt-glass-edge: var(--kt-linev);
    --kt-liquid: color-mix(in oklab, var(--kt-sf0) 88%, transparent);
    --kt-liquid-tint: color-mix(in oklab, var(--kt-pric) 86%, transparent);
    --kt-liquid-edge: var(--kt-linev);
    --kt-liquid-blur: blur(18px) saturate(1.4);
    --kt-liquid-shadow: var(--kt-shadow-menu);
  }

  :root[data-kt-m3-root][data-theme="dark"],
  :host([data-theme="dark"]),
  .kt-m3-root[data-theme="dark"] {
    --kt-glass: color-mix(in oklab, var(--kt-sf0) 92%, transparent);
    --kt-glass-strong: color-mix(in oklab, var(--kt-sf1) 95%, transparent);
    --kt-glass-bg: color-mix(in oklab, var(--kt-bg) 92%, transparent);
    --kt-glass-tint: color-mix(in oklab, var(--kt-pric) 90%, transparent);
    --kt-glass-edge: var(--kt-linev);
    --kt-liquid: color-mix(in oklab, var(--kt-sf0) 90%, transparent);
    --kt-liquid-tint: color-mix(in oklab, var(--kt-pric) 90%, transparent);
    --kt-liquid-edge: var(--kt-linev);
    --kt-liquid-shadow: var(--kt-shadow-menu);
  }
}

.kt-m3-root,
.kt-m3-root *,
.kt-m3-root *::before,
.kt-m3-root *::after {
  box-sizing: border-box;
}

:where(.kt-m3-root button:not(.MuiButtonBase-root)),
.kt-m3-root input,
.kt-m3-root select,
.kt-m3-root textarea {
  font: inherit;
}

.kt-m3-root input,
.kt-m3-root select,
.kt-m3-root textarea { color: inherit; }

.kt-m3-root .MuiInputBase-input {
  box-sizing: content-box;
}

.kt-m3-root button {
  -webkit-tap-highlight-color: transparent;
}

.kt-m3-root :focus {
  outline: 2px solid var(--kt-pri);
  outline-offset: 2px;
}

@supports selector(:focus-visible) {
  .kt-m3-root :focus { outline: none; }
  .kt-m3-root :focus-visible {
    outline: 2px solid var(--kt-pri);
    outline-offset: 2px;
  }
}

@media (forced-colors: active) {
  .kt-m3-root :focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}

.kt-m3-root .MuiInputBase-input:focus {
  outline: none;
}

.kt-m3-root .MuiButtonBase-root input:focus,
.kt-m3-root .MuiSlider-input:focus {
  outline: none;
}

@supports selector(:focus-visible) {
  .kt-m3-root .MuiInputBase-input:focus-visible { outline: none; }
  .kt-m3-root .MuiButtonBase-root input:focus-visible,
  .kt-m3-root .MuiSlider-input:focus-visible { outline: none; }
}

@supports not (scrollbar-color: auto) {
  .kt-m3-root ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .kt-m3-root ::-webkit-scrollbar-thumb {
    background: var(--kt-scrollbar-thumb);
    background-clip: content-box;
    border: 2px solid transparent;
    border-radius: 999px;
  }

  .kt-m3-root ::-webkit-scrollbar-track {
    background: transparent;
  }
}

.kt-m3-root textarea.kt-resizable-textarea:not([aria-hidden="true"])::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

@supports selector(textarea::-webkit-resizer) {
  .kt-m3-root textarea.kt-resizable-textarea:not([aria-hidden="true"])::-webkit-resizer {
    background-color: transparent;
    background-image: linear-gradient(
      135deg,
      transparent 0 42%,
      var(--kt-onv) 43% 51%,
      transparent 52% 64%,
      var(--kt-onv) 65% 73%,
      transparent 74%
    );
    background-repeat: no-repeat;
    background-position: right 6px bottom 6px;
    background-size: 10px 10px;
  }
}

/* Shared missing-API-key notice styled consistently across Options and overlays. */
.kt-api-key-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--kt-space-xs, 8px);
  padding: var(--kt-space-sm, 12px) var(--kt-space-md, 16px);
  border: 1px solid var(--kt-linev);
  border-inline-start: 3px solid var(--kt-warn);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-warnc);
  color: var(--kt-onwarnc);
}

.kt-api-key-empty p {
  margin: 0;
  max-width: 65ch;
  color: inherit;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  line-height: 1.5;
  white-space: normal;
}

.kt-api-key-empty button {
  min-height: 32px;
  padding: 6px 12px;
  border: 0;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-pri);
  color: var(--kt-onpri);
  font: inherit;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 600;
  line-height: 1.25;
  cursor: pointer;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), opacity var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}

@media (hover: hover) {
  .kt-api-key-empty button:hover {
    opacity: 0.92;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .kt-api-key-empty button {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), opacity var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }

  .kt-api-key-empty button:active {
    transform: scale(0.98);
  }
}

@keyframes kt-m3-pop {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: none; }
}

@keyframes kt-m3-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@keyframes kt-m3-spin {
  to { transform: rotate(360deg); }
}

/* Compositor-only progress sweep; track consumers set left: 0; width: 42%; transform-origin: left center. */
@keyframes kt-m3-sweep-x {
  0% { transform: translateX(-100%) scaleX(0.45); }
  55%, 100% { transform: translateX(240%) scaleX(0.65); }
}

@media (prefers-reduced-motion: reduce) {
  :root[data-kt-m3-root] .MuiCircularProgress-svg,
  .kt-m3-root .MuiCircularProgress-svg {
    animation-duration: 3.6s;
  }
}
`;
