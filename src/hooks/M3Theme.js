import { useLayoutEffect, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, GlobalStyles } from "@mui/material";
import { useDarkMode } from "./ColorMode";
import { THEME_DARK, THEME_LIGHT } from "../config";
import {
  createM3CssVariables,
  M3_DURATION,
  M3_EASE,
  M3_FONT_FAMILY,
  M3_GLOBAL_CSS,
  M3_RADIUS_CONTROL,
  M3_RADIUS_PANEL,
  M3_RADIUS_SM,
  M3_RADIUS_SURFACE,
  M3_TEXT_BODY,
  M3_TEXT_HEADING,
  M3_TEXT_SM,
  resolveM3Colors,
  resolveM3ThemeMode,
} from "../styles/m3";
import { getMuiSwitchStyleOverrides } from "./themeStyles";
import { useSystemDarkPreference } from "./SystemColorScheme";

export { getMuiSwitchStyleOverrides } from "./themeStyles";

const EMPTY_THEME_OPTIONS = Object.freeze({});
const EMPTY_GLOBAL_STYLES = Object.freeze({});
const standaloneRootStack = [];
let initialRootSnapshot = null;

function ensureSnapshotVars(root, snapshot, cssVariables) {
  Object.keys(cssVariables).forEach((name) => {
    if (!snapshot.vars.has(name)) {
      snapshot.vars.set(name, root.style.getPropertyValue(name));
    }
  });
}

function applyStandaloneRootEntry(root, entry) {
  root.setAttribute("data-theme", entry.resolvedMode);
  root.setAttribute("data-kt-m3-root", "true");
  root.style.colorScheme = entry.resolvedMode;
  Object.entries(entry.cssVariables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function restoreRootSnapshot(root, snapshot) {
  if (!snapshot) return;
  if (snapshot.theme === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", snapshot.theme);
  if (snapshot.marker === null) root.removeAttribute("data-kt-m3-root");
  else root.setAttribute("data-kt-m3-root", snapshot.marker);
  root.style.colorScheme = snapshot.colorScheme;
  snapshot.vars.forEach((value, name) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  });
}

export default function M3Theme({
  children,
  options = EMPTY_THEME_OPTIONS,
  styles = EMPTY_GLOBAL_STYLES,
  standaloneRoot = false,
  isolateRem = false,
}) {
  const { darkMode } = useDarkMode();
  const systemPrefersDark = useSystemDarkPreference();

  const previewMode =
    process.env.NODE_ENV === "development"
      ? new URLSearchParams(window.location.search).get("theme")
      : null;
  const resolvedMode =
    previewMode === THEME_DARK || previewMode === THEME_LIGHT
      ? previewMode
      : resolveM3ThemeMode(darkMode, systemPrefersDark);
  const colors = useMemo(() => resolveM3Colors(resolvedMode), [resolvedMode]);
  const cssVariables = useMemo(() => createM3CssVariables(colors), [colors]);

  useLayoutEffect(() => {
    if (!standaloneRoot || typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (standaloneRootStack.length === 0) {
      initialRootSnapshot = {
        theme: root.getAttribute("data-theme"),
        marker: root.getAttribute("data-kt-m3-root"),
        colorScheme: root.style.colorScheme,
        vars: new Map(),
      };
    }
    ensureSnapshotVars(root, initialRootSnapshot, cssVariables);

    const entry = { resolvedMode, cssVariables };
    standaloneRootStack.push(entry);
    applyStandaloneRootEntry(root, entry);

    return () => {
      const index = standaloneRootStack.lastIndexOf(entry);
      if (index !== -1) {
        standaloneRootStack.splice(index, 1);
      }
      if (standaloneRootStack.length > 0) {
        const top = standaloneRootStack[standaloneRootStack.length - 1];
        Object.keys(entry.cssVariables).forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(top.cssVariables, name)) {
            const initialValue = initialRootSnapshot?.vars.get(name);
            if (initialValue) root.style.setProperty(name, initialValue);
            else root.style.removeProperty(name);
          }
        });
        applyStandaloneRootEntry(root, top);
        return;
      }
      const snapshot = initialRootSnapshot;
      initialRootSnapshot = null;
      restoreRootSnapshot(root, snapshot);
    };
  }, [cssVariables, resolvedMode, standaloneRoot]);

  const theme = useMemo(() => {
    const color = colors;
    const focusRing = {
      outline: `2px solid ${color.primary}`,
      outlineOffset: 2,
      "@media (forced-colors: active)": {
        outline: "2px solid Highlight",
      },
    };
    const insetFocusRing = {
      outline: "none",
      boxShadow: `inset 0 0 0 2px ${color.primary}`,
      "@media (forced-colors: active)": {
        outline: "2px solid Highlight",
        outlineOffset: -2,
      },
    };
    let htmlFontSize = 16;
    if (!isolateRem) {
      try {
        htmlFontSize = Number.parseInt(
          window.getComputedStyle(document.documentElement).fontSize,
          10
        );
      } catch (_error) {
        htmlFontSize = 16;
      }
    }

    const headingSize = isolateRem ? M3_TEXT_HEADING : "0.9375rem";
    const bodySize = isolateRem ? M3_TEXT_BODY : "0.875rem";
    const smSize = isolateRem ? M3_TEXT_SM : "0.8125rem";
    const shrunkLabelSize = isolateRem
      ? M3_TEXT_SM / 0.75
      : `${M3_TEXT_SM / 0.75 / 16}rem`;

    const motion = `${M3_DURATION} ${M3_EASE}`;
    const stateMotion = `background-color ${motion}, color ${motion}, border-color ${motion}, box-shadow ${motion}`;
    const stateAndTransformMotion = `${stateMotion}, transform ${motion}`;
    const overlaySurface = `var(--kt-liquid, ${color.surface})`;

    const themeOptions = {
      palette: {
        mode: resolvedMode,
        primary: { main: color.primary, contrastText: color.onPrimary },
        secondary: {
          main: color.primaryContainer,
          contrastText: color.onPrimaryContainer,
        },
        error: { main: color.error },
        warning: {
          main: color.warning,
          contrastText: color.onWarning,
        },
        success: { main: color.success },
        background: { default: color.background, paper: color.surface },
        text: {
          primary: color.onSurface,
          secondary: color.onSurfaceVariant,
        },
        divider: color.outlineVariant,
      },
      shape: { borderRadius: M3_RADIUS_CONTROL },
      typography: (palette) => {
        const typography =
          typeof options.typography === "function"
            ? options.typography(palette)
            : options.typography;
        // Resolve conversions before MUI generates sizes for each variant.
        return {
          ...(isolateRem
            ? { pxToRem: (size) => `${size}px` }
            : { htmlFontSize }),
          fontFamily: M3_FONT_FAMILY,
          h6: { fontSize: headingSize, fontWeight: 600, lineHeight: 1.35 },
          subtitle1: {
            fontSize: headingSize,
            fontWeight: 600,
            lineHeight: 1.35,
          },
          subtitle2: { fontSize: bodySize, fontWeight: 600, lineHeight: 1.4 },
          body1: { fontSize: bodySize, lineHeight: 1.5 },
          body2: { fontSize: bodySize, lineHeight: 1.5 },
          caption: { fontSize: smSize, lineHeight: 1.45 },
          ...typography,
          button: {
            fontSize: bodySize,
            textTransform: "none",
            fontWeight: 600,
            ...typography?.button,
          },
        };
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            html: { backgroundColor: color.background },
            body: {
              backgroundColor: color.background,
              color: color.onSurface,
              fontSize: bodySize,
              lineHeight: 1.5,
            },
            "#root": { minHeight: "100%" },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
              backgroundColor: color.surface,
              borderColor: color.outlineVariant,
              colorScheme: resolvedMode,
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              minHeight: 36,
              borderRadius: M3_RADIUS_CONTROL,
              paddingInline: 14,
              fontWeight: 600,
              letterSpacing: 0,
              transition: stateMotion,
              "@media (prefers-reduced-motion: no-preference)": {
                transition: stateAndTransformMotion,
                "&:active": { transform: "scale(0.98)" },
              },
              "&.Mui-focusVisible": focusRing,
            },
            sizeSmall: {
              minHeight: 32,
              paddingInline: 12,
            },
            contained: { boxShadow: "none" },
            outlined: {
              borderColor: color.outline,
              color: color.onSurface,
              "&:hover": {
                borderColor: color.onSurface,
                backgroundColor: color.surfaceLow,
              },
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: ({ ownerState }) => ({
              borderRadius: M3_RADIUS_CONTROL,
              ...(ownerState.color === "default" && {
                color: color.onSurfaceVariant,
                "&:hover": {
                  backgroundColor: color.surfaceContainer,
                  color: color.onSurface,
                },
              }),
              transition: stateMotion,
              "@media (prefers-reduced-motion: no-preference)": {
                transition: stateAndTransformMotion,
                "&:active": { transform: "scale(0.95)" },
              },
              "&.Mui-focusVisible": focusRing,
            }),
          },
        },
        MuiTextField: {
          defaultProps: { variant: "filled" },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              color: color.onSurfaceVariant,
              fontSize: bodySize,
            },
            shrink: {
              fontSize: shrunkLabelSize,
            },
          },
        },
        MuiFormHelperText: {
          styleOverrides: {
            root: {
              fontSize: smSize,
              lineHeight: 1.45,
              color: color.onSurfaceVariant,
              marginInline: 2,
            },
          },
        },
        MuiFilledInput: {
          defaultProps: { disableUnderline: true },
          styleOverrides: {
            root: {
              minHeight: 38,
              overflow: "hidden",
              border: `1px solid ${color.outline}`,
              borderRadius: M3_RADIUS_CONTROL,
              backgroundColor: color.surface,
              transition: `border-color ${motion}, box-shadow ${motion}, background-color ${motion}`,
              "&:not(.Mui-disabled, .Mui-focused, .Mui-error):hover": {
                borderColor: color.onSurface,
                backgroundColor: color.surface,
              },
              "&.Mui-focused": {
                borderColor: color.primary,
                backgroundColor: color.surface,
                boxShadow: `0 0 0 1px ${color.primary}`,
                "@media (forced-colors: active)": {
                  outline: "2px solid Highlight",
                  outlineOffset: 1,
                },
              },
              "&.Mui-error": {
                borderColor: color.error,
              },
              "&.Mui-error.Mui-focused": {
                borderColor: color.error,
                boxShadow: `0 0 0 1px ${color.error}`,
              },
              "&.Mui-disabled": {
                borderColor: color.outlineVariant,
                backgroundColor: color.surfaceLow,
              },
            },
            input: {
              paddingTop: 18,
              paddingBottom: 6,
              "&.MuiInputBase-inputMultiline": {
                paddingTop: 0,
                paddingBottom: 0,
              },
            },
            inputHiddenLabel: {
              paddingTop: 8,
              paddingBottom: 8,
              "&.MuiInputBase-inputMultiline": {
                paddingTop: 0,
                paddingBottom: 0,
              },
            },
            multiline: {
              paddingTop: 22,
              paddingBottom: 8,
              "&.MuiInputBase-hiddenLabel, &.MuiFilledInput-hiddenLabel, &:has(.MuiFilledInput-inputHiddenLabel)":
                {
                  paddingTop: 9,
                  paddingBottom: 9,
                },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              minHeight: 38,
              borderRadius: M3_RADIUS_CONTROL,
              backgroundColor: color.surface,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: color.outline,
              },
              "&:not(.Mui-disabled, .Mui-focused, .Mui-error):hover .MuiOutlinedInput-notchedOutline":
                {
                  borderColor: color.onSurface,
                },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: color.primary,
                borderWidth: 2,
              },
            },
          },
        },
        MuiSelect: {
          styleOverrides: {
            select: {
              "&:focus": {
                borderRadius: "inherit",
                backgroundColor: "transparent",
              },
            },
            icon: {
              color: color.onSurfaceVariant,
              "@media (prefers-reduced-motion: no-preference)": {
                transition: `transform ${motion}`,
              },
            },
          },
        },
        MuiSwitch: {
          styleOverrides: getMuiSwitchStyleOverrides(color),
        },
        MuiSlider: {
          styleOverrides: {
            thumb: {
              "&.Mui-focusVisible": focusRing,
            },
          },
        },
        MuiRadio: {
          styleOverrides: {
            root: {
              "&.Mui-focusVisible": {
                ...focusRing,
                outlineOffset: 0,
              },
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              minHeight: 36,
              padding: 3,
              borderRadius: M3_RADIUS_CONTROL,
              backgroundColor: color.surfaceContainer,
            },
            indicator: { display: "none" },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minWidth: 0,
              maxWidth: "100%",
              minHeight: 30,
              overflow: "hidden",
              padding: "4px 12px",
              borderRadius: 8,
              color: color.onSurfaceVariant,
              fontSize: bodySize,
              fontWeight: 600,
              textOverflow: "ellipsis",
              textTransform: "none",
              transition: stateMotion,
              whiteSpace: "nowrap",
              "&:hover": {
                color: color.onSurface,
              },
              "&.Mui-selected": {
                backgroundColor: color.surface,
                color: color.onSurface,
                fontWeight: 600,
                boxShadow: "var(--kt-shadow-card)",
              },
              "&&.Mui-focusVisible": insetFocusRing,
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              minHeight: 36,
              borderRadius: M3_RADIUS_SM,
              color: color.onSurface,
              fontSize: bodySize,
              transition: stateMotion,
              "&:hover": {
                backgroundColor: color.surfaceLow,
              },
              "&.Mui-selected": {
                backgroundColor: color.primaryContainer,
                color: color.onPrimaryContainer,
                fontWeight: 600,
              },
              "&.Mui-selected:hover": {
                backgroundColor: color.primaryContainer,
              },
              "&&.Mui-focusVisible": {
                ...insetFocusRing,
                backgroundColor: color.surfaceHigh,
              },
              "&&.Mui-selected.Mui-focusVisible": {
                ...insetFocusRing,
                backgroundColor: color.primaryContainer,
                color: color.onPrimaryContainer,
              },
            },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              minHeight: 34,
              borderRadius: M3_RADIUS_CONTROL,
              borderColor: color.outlineVariant,
              color: color.onSurfaceVariant,
              fontSize: bodySize,
              fontWeight: 500,
              transition: stateMotion,
              "&:hover": {
                backgroundColor: color.surfaceLow,
                color: color.onSurface,
              },
              "&.Mui-selected": {
                backgroundColor: color.primaryContainer,
                color: color.onPrimaryContainer,
                fontWeight: 600,
              },
              "&.Mui-selected:hover": {
                backgroundColor: color.primaryContainer,
              },
              "&&.Mui-focusVisible": insetFocusRing,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: M3_RADIUS_CONTROL,
              transition: stateMotion,
              "&.Mui-selected": {
                backgroundColor: color.primaryContainer,
                color: color.onPrimaryContainer,
              },
              "&.Mui-selected:hover": {
                backgroundColor: color.primaryContainer,
              },
              "&&.Mui-focusVisible": {
                ...insetFocusRing,
                backgroundColor: color.surfaceHigh,
              },
              "&&.Mui-selected.Mui-focusVisible": {
                ...insetFocusRing,
                backgroundColor: color.primaryContainer,
                color: color.onPrimaryContainer,
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              border: `1px solid ${color.outlineVariant}`,
              borderRadius: M3_RADIUS_SURFACE,
              backgroundColor: color.surface,
              boxShadow: "none",
            },
          },
        },
        MuiAccordion: {
          defaultProps: { disableGutters: true },
          styleOverrides: {
            root: {
              overflow: "hidden",
              border: `1px solid ${color.outlineVariant}`,
              borderRadius: M3_RADIUS_SURFACE,
              backgroundColor: color.surface,
              boxShadow: "none",
              "&::before": { display: "none" },
            },
          },
        },
        MuiAccordionSummary: {
          styleOverrides: {
            root: {
              "&&.Mui-focusVisible": {
                ...insetFocusRing,
                backgroundColor: color.surfaceHigh,
              },
            },
          },
        },
        MuiLoadingButton: {
          styleOverrides: {
            loadingIndicator: { color: color.primary },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              border: `1px solid ${color.outlineVariant}`,
              borderRadius: M3_RADIUS_PANEL,
              backgroundColor: color.surface,
              boxShadow: "var(--kt-shadow-menu)",
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              border: `1px solid ${color.outlineVariant}`,
              borderRadius: M3_RADIUS_SURFACE,
              backgroundColor: overlaySurface,
              boxShadow: "var(--kt-shadow-menu)",
              WebkitBackdropFilter: "var(--kt-liquid-blur)",
              backdropFilter: "var(--kt-liquid-blur)",
            },
            list: {
              padding: 4,
            },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              borderRadius: M3_RADIUS_SM,
              fontSize: smSize,
              lineHeight: 1.4,
            },
          },
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              border: `1px solid ${color.outlineVariant}`,
              borderRadius: M3_RADIUS_SURFACE,
              backgroundColor: overlaySurface,
              boxShadow: "var(--kt-shadow-menu)",
              WebkitBackdropFilter: "var(--kt-liquid-blur)",
              backdropFilter: "var(--kt-liquid-blur)",
            },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: {
              borderRadius: M3_RADIUS_SURFACE,
              fontSize: bodySize,
              lineHeight: 1.5,
            },
          },
        },
        MuiSnackbarContent: {
          styleOverrides: {
            root: {
              borderRadius: M3_RADIUS_CONTROL,
              fontSize: bodySize,
            },
          },
        },
      },
      ...Object.fromEntries(
        Object.entries(options).filter(
          ([key]) => key !== "components" && key !== "typography"
        )
      ),
    };
    return createTheme(themeOptions, { components: options.components || {} });
  }, [colors, isolateRem, options, resolvedMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={styles} />
      <div
        className="kt-m3-root"
        data-theme={resolvedMode}
        data-isolate-rem={isolateRem ? "true" : undefined}
        style={{
          ...cssVariables,
          colorScheme: resolvedMode,
        }}
      >
        <style>{M3_GLOBAL_CSS}</style>
        {children}
      </div>
    </ThemeProvider>
  );
}
