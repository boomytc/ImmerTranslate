export const M3_COLORS = {
  light: {
    primary: "#0B57D0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D3E3FD",
    onPrimaryContainer: "#041E49",
    secondaryContainer: "#C2E7FF",
    onSecondaryContainer: "#001D35",
    tertiaryContainer: "#C4EED0",
    onTertiaryContainer: "#072711",
    error: "#B3261E",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#8C1D18",
    success: "#146C2E",
    background: "#F8FAFD",
    surface: "#FFFFFF",
    surfaceLow: "#F3F6FB",
    surfaceContainer: "#F0F4F9",
    surfaceHigh: "#E9EEF6",
    surfaceHighest: "#DDE3EA",
    onSurface: "#1F1F1F",
    onSurfaceVariant: "#444746",
    outline: "#747775",
    outlineVariant: "#C9CDD3",
    inverseSurface: "#2F3033",
    onInverseSurface: "#F1F1F1",
  },
  dark: {
    primary: "#A8C7FA",
    onPrimary: "#062E6F",
    primaryContainer: "#0842A0",
    onPrimaryContainer: "#D3E3FD",
    secondaryContainer: "#004A77",
    onSecondaryContainer: "#C2E7FF",
    tertiaryContainer: "#0F5223",
    onTertiaryContainer: "#C4EED0",
    error: "#F2B8B5",
    errorContainer: "#601410",
    onErrorContainer: "#F9DEDC",
    success: "#6DD58C",
    background: "#131314",
    surface: "#1E1F20",
    surfaceLow: "#232426",
    surfaceContainer: "#282A2C",
    surfaceHigh: "#2D2F31",
    surfaceHighest: "#37393B",
    onSurface: "#E3E3E3",
    onSurfaceVariant: "#C4C7C5",
    outline: "#8E918F",
    outlineVariant: "#3F4245",
    inverseSurface: "#E3E3E3",
    onInverseSurface: "#303030",
  },
};

export const M3_BRAND_COLORS = {
  blue: { light: {}, dark: {} },
  cyan: {
    light: {
      primary: "#006874",
      onPrimary: "#FFFFFF",
      primaryContainer: "#97F0FF",
      onPrimaryContainer: "#001F24",
      secondaryContainer: "#CDE7EC",
      onSecondaryContainer: "#051F23",
    },
    dark: {
      primary: "#4FD8EB",
      onPrimary: "#00363D",
      primaryContainer: "#004F58",
      onPrimaryContainer: "#97F0FF",
      secondaryContainer: "#334B4F",
      onSecondaryContainer: "#CDE7EC",
    },
  },
  violet: {
    light: {
      primary: "#6750A4",
      onPrimary: "#FFFFFF",
      primaryContainer: "#EADDFF",
      onPrimaryContainer: "#21005D",
      secondaryContainer: "#E8DEF8",
      onSecondaryContainer: "#1D192B",
    },
    dark: {
      primary: "#D0BCFF",
      onPrimary: "#381E72",
      primaryContainer: "#4F378B",
      onPrimaryContainer: "#EADDFF",
      secondaryContainer: "#4A4458",
      onSecondaryContainer: "#E8DEF8",
    },
  },
};

export function resolveM3Colors(mode = "light", brand = "blue") {
  return {
    ...M3_COLORS[mode],
    ...(M3_BRAND_COLORS[brand]?.[mode] || {}),
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
    "--kt-inv": colors.inverseSurface,
    "--kt-oninv": colors.onInverseSurface,
  };
}

export function createM3CssVariableDeclarations(colors) {
  return Object.entries(createM3CssVariables(colors))
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n");
}

export const M3_FONT_FAMILY =
  '"Google Sans Flex", "Google Sans", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Chrome motion stays inside 150–250ms and does not overshoot.
export const M3_EASE = "cubic-bezier(.22, 1, .36, 1)";
export const M3_DURATION = ".15s";
export const M3_DURATION_FAST = ".25s";

// LightUI radius steps (tokens.css). Semantic aliases below stay for in-page
// translation surfaces so this chrome pass does not restyle them.
export const M3_RADIUS_XS = 6;
export const M3_RADIUS_SM = 8;
export const M3_RADIUS_MD = 12;
export const M3_RADIUS_LG = 16;
export const M3_RADIUS_XL = 22;
export const M3_RADIUS_2XL = 28;
export const M3_RADIUS_CONTROL = M3_RADIUS_LG;
export const M3_RADIUS_CARD = 20;
export const M3_RADIUS_SHEET = 18;
export const M3_RADIUS_CHIP = 14;

// 4pt chrome spacing. Ball menu, popup, and options shell share this scale.
export const M3_SPACE_2XS = 4;
export const M3_SPACE_XS = 8;
export const M3_SPACE_SM = 12;
export const M3_SPACE_MD = 16;
export const M3_SPACE_LG = 20;
export const M3_SPACE_XL = 24;
export const M3_CHROME_INSET = M3_SPACE_MD;

export const M3_GLOBAL_CSS = String.raw`
:host,
.kt-m3-root {
  --kt-ease: ${M3_EASE};
  --kt-dur: ${M3_DURATION};
  --kt-dur-fast: ${M3_DURATION_FAST};
  --kt-radius-xs: ${M3_RADIUS_XS}px;
  --kt-radius-sm: ${M3_RADIUS_SM}px;
  --kt-radius-md: ${M3_RADIUS_MD}px;
  --kt-radius-lg: ${M3_RADIUS_LG}px;
  --kt-radius-xl: ${M3_RADIUS_XL}px;
  --kt-radius-2xl: ${M3_RADIUS_2XL}px;
  --kt-radius-card: ${M3_RADIUS_CARD}px;
  --kt-radius-control: ${M3_RADIUS_CONTROL}px;
  --kt-radius-sheet: ${M3_RADIUS_SHEET}px;
  --kt-radius-chip: ${M3_RADIUS_CHIP}px;
  --kt-space-2xs: ${M3_SPACE_2XS}px;
  --kt-space-xs: ${M3_SPACE_XS}px;
  --kt-space-sm: ${M3_SPACE_SM}px;
  --kt-space-md: ${M3_SPACE_MD}px;
  --kt-space-lg: ${M3_SPACE_LG}px;
  --kt-space-xl: ${M3_SPACE_XL}px;
  --kt-chrome-inset: ${M3_CHROME_INSET}px;
  --kt-border: rgb(23 24 28 / 0.08);
  --kt-border-strong: rgb(23 24 28 / 0.14);
  --kt-glass-blur: blur(22px) saturate(1.6);
  --kt-liquid: var(--kt-sf0);
  --kt-liquid-tint: var(--kt-pric);
  --kt-liquid-edge: var(--kt-border-strong);
  --kt-liquid-blur: none;
  --kt-shadow-card: 0 1px 2px rgb(23 24 28 / 0.04), 0 10px 28px rgb(23 24 28 / 0.05);
  --kt-shadow-menu: 0 1px 2px rgb(23 24 28 / 0.04), 0 16px 40px rgb(23 24 28 / 0.08);
  --kt-shadow-border: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04);
  --kt-shadow-border-hover: 0 0 0 1px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08), 0 2px 4px 0 rgb(0 0 0 / 0.06);
  --kt-liquid-shadow: var(--kt-shadow-menu);
  --kt-shadow-1: 0 1px 2px rgba(0, 0, 0, .14), 0 1px 6px 1px rgba(0, 0, 0, .08);
  --kt-shadow-2: 0 4px 8px 3px rgba(0, 0, 0, .1), 0 1px 3px rgba(0, 0, 0, .18);
  color: var(--kt-on);
  font-family: "Google Sans Flex", "Google Sans", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.kt-m3-root[data-theme="dark"] {
  --kt-border: rgb(255 255 255 / 0.08);
  --kt-border-strong: rgb(255 255 255 / 0.14);
  --kt-shadow-card: 0 1px 2px rgb(0 0 0 / 0.28), 0 10px 28px rgb(0 0 0 / 0.22);
  --kt-shadow-menu: 0 1px 2px rgb(0 0 0 / 0.35), 0 16px 40px rgb(0 0 0 / 0.4);
  --kt-shadow-border: 0 0 0 1px rgb(255 255 255 / 0.08);
  --kt-shadow-border-hover: 0 0 0 1px rgb(255 255 255 / 0.13);
  --kt-shadow-1: 0 1px 2px rgba(0, 0, 0, .5), 0 1px 6px 1px rgba(0, 0, 0, .35);
  --kt-shadow-2: 0 4px 10px 3px rgba(0, 0, 0, .45), 0 1px 3px rgba(0, 0, 0, .5);
}

/* Translucent chrome only when blur can keep text readable. Otherwise surfaces stay solid. */
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) and (color: color-mix(in srgb, white 50%, transparent)) {
  :host,
  .kt-m3-root {
    --kt-glass: color-mix(in srgb, var(--kt-sf0) 82%, transparent);
    --kt-glass-strong: color-mix(in srgb, var(--kt-sf1) 92%, transparent);
    --kt-glass-bg: color-mix(in srgb, var(--kt-bg) 88%, transparent);
    --kt-glass-tint: color-mix(in srgb, var(--kt-pric) 78%, transparent);
    --kt-glass-edge: color-mix(in srgb, var(--kt-sf0) 64%, var(--kt-linev));
    --kt-liquid: color-mix(in srgb, var(--kt-sf0) 82%, transparent);
    --kt-liquid-tint: color-mix(in srgb, var(--kt-pric) 78%, transparent);
    --kt-liquid-edge: color-mix(in srgb, white 72%, var(--kt-border-strong));
    --kt-liquid-blur: blur(22px) saturate(1.75) brightness(1.06);
    --kt-liquid-shadow: inset 0 1px 0 color-mix(in srgb, white 74%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--kt-on) 6%, transparent), 0 10px 30px -12px color-mix(in srgb, var(--kt-on) 18%, transparent);
  }

  .kt-m3-root[data-theme="dark"] {
    --kt-glass: color-mix(in srgb, var(--kt-sf0) 90%, transparent);
    --kt-glass-strong: color-mix(in srgb, var(--kt-sf1) 94%, transparent);
    --kt-glass-bg: color-mix(in srgb, var(--kt-bg) 92%, transparent);
    --kt-glass-tint: color-mix(in srgb, var(--kt-pric) 86%, transparent);
    --kt-glass-edge: color-mix(in srgb, var(--kt-on) 18%, var(--kt-linev));
    --kt-liquid: color-mix(in srgb, var(--kt-sf0) 78%, transparent);
    --kt-liquid-tint: color-mix(in srgb, var(--kt-pric) 82%, transparent);
    --kt-liquid-edge: color-mix(in srgb, white 24%, transparent);
    --kt-liquid-shadow: inset 0 1px 0 color-mix(in srgb, white 22%, transparent), 0 10px 30px -12px color-mix(in srgb, black 40%, transparent);
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

.kt-m3-root ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.kt-m3-root ::-webkit-scrollbar-thumb {
  background: var(--kt-sf4);
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 999px;
}

.kt-m3-root ::-webkit-scrollbar-track {
  background: transparent;
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
    background-image: linear-gradient(
      135deg,
      transparent 0 42%,
      color-mix(in srgb, var(--kt-onv) 68%, transparent) 43% 51%,
      transparent 52% 64%,
      color-mix(in srgb, var(--kt-onv) 68%, transparent) 65% 73%,
      transparent 74%
    );
    background-repeat: no-repeat;
    background-position: right 6px bottom 6px;
    background-size: 10px 10px;
  }
}

@keyframes kt-m3-pop {
  from { opacity: 0; transform: scale(.96); }
  to { opacity: 1; transform: none; }
}

@keyframes kt-m3-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

@keyframes kt-m3-spin { to { transform: rotate(360deg); } }

@keyframes kt-m3-sweep {
  0% { left: -40%; width: 40%; }
  55%, 100% { left: 100%; width: 55%; }
}

@keyframes kt-m3-glow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .kt-m3-root *,
  .kt-m3-root *::before,
  .kt-m3-root *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;
