/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import M3Theme from "./M3Theme";
import {
  M3_DURATION,
  M3_EASE,
  M3_FONT_FAMILY,
  M3_RADIUS_2XL,
  M3_RADIUS_CARD,
  M3_RADIUS_CHIP,
  M3_RADIUS_CONTROL,
  M3_RADIUS_XL,
} from "../styles/m3";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./ColorMode", () => ({
  useDarkMode: () => ({ darkMode: "auto" }),
}));
jest.mock("./SystemColorScheme", () => ({
  useSystemDarkPreference: () => true,
}));

test("scopes the resolved Material 3 palette to its root", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <M3Theme>
        <span>content</span>
        <IconButton aria-label="default icon">D</IconButton>
        <IconButton aria-label="primary icon" color="primary">
          P
        </IconButton>
        <ThemeProbe />
      </M3Theme>
    );
  });

  const themeRoot = container.querySelector(".kt-m3-root");
  expect(themeRoot.dataset.theme).toBe("dark");
  expect(themeRoot.style.getPropertyValue("--kt-pri")).toBe("#A8C7FA");
  expect(themeRoot.querySelector("style").textContent).toContain(
    "@keyframes kt-m3-pop"
  );
  expect(capturedTheme.shape.borderRadius).toBe(12);
  expect(
    capturedTheme.components.MuiPaper.styleOverrides.root.colorScheme
  ).toBe("dark");
  expect(
    capturedTheme.components.MuiFilledInput.styleOverrides.root
  ).toMatchObject({
    borderRadius: M3_RADIUS_CONTROL,
    overflow: "hidden",
  });
  const filledInputRoot =
    capturedTheme.components.MuiFilledInput.styleOverrides.root;
  const filledInputHover =
    filledInputRoot["&:not(.Mui-disabled, .Mui-focused):hover"];
  expect(filledInputHover.backgroundColor).toBe("#2D2F31");
  expect(filledInputHover["@media (hover: none)"].backgroundColor).toBe(
    "#282A2C"
  );
  expect(filledInputRoot["&.Mui-error"].borderColor).toBe("#F2B8B5");
  expect(filledInputRoot["&.Mui-error.Mui-focused"].borderColor).toBe(
    "#F2B8B5"
  );
  expect(
    capturedTheme.components.MuiSelect.styleOverrides.select["&:focus"]
  ).toMatchObject({
    borderRadius: "inherit",
    backgroundColor: "transparent",
  });
  expect(capturedTheme.components.MuiSelect.styleOverrides.icon).toMatchObject({
    transition: `transform ${M3_DURATION} ${M3_EASE}`,
  });
  expect(
    capturedTheme.components.MuiButton.styleOverrides.root.transition
  ).toContain(`border-color ${M3_DURATION}`);
  expect(
    capturedTheme.components.MuiButton.styleOverrides.root.transition
  ).toContain(M3_EASE);
  expect(
    capturedTheme.components.MuiButton.styleOverrides.root["&.Mui-focusVisible"]
  ).toEqual({
    outline: "2px solid #A8C7FA",
    outlineOffset: 2,
  });
  expect(capturedTheme.components.MuiCard.styleOverrides.root).toMatchObject({
    borderRadius: M3_RADIUS_CARD,
  });
  expect(capturedTheme.components.MuiTab.styleOverrides.root).toMatchObject({
    fontWeight: 650,
    transition: `transform ${M3_DURATION} ${M3_EASE}, box-shadow ${M3_DURATION} ${M3_EASE}, border-color ${M3_DURATION} ${M3_EASE}`,
  });
  expect(
    capturedTheme.components.MuiTab.styleOverrides.root["&&.Mui-focusVisible"]
  ).toMatchObject({
    outline: "none",
    boxShadow: "inset 0 0 0 2px #A8C7FA",
  });
  const menuItemRoot = capturedTheme.components.MuiMenuItem.styleOverrides.root;
  expect(menuItemRoot).toMatchObject({
    borderRadius: M3_RADIUS_CHIP,
    color: "#E3E3E3",
    transition: `transform ${M3_DURATION} ${M3_EASE}, box-shadow ${M3_DURATION} ${M3_EASE}, border-color ${M3_DURATION} ${M3_EASE}`,
  });
  expect(menuItemRoot["&.Mui-selected"]).toMatchObject({
    backgroundColor: "#004A77",
    color: "#C2E7FF",
  });
  expect(menuItemRoot["&&.Mui-focusVisible"]).toMatchObject({
    outline: "none",
    backgroundColor: "#2D2F31",
    boxShadow: "inset 0 0 0 2px #A8C7FA",
  });
  const iconButtonRoot =
    capturedTheme.components.MuiIconButton.styleOverrides.root;
  const defaultIconButton = iconButtonRoot({
    ownerState: { color: "default" },
  });
  const primaryIconButton = iconButtonRoot({
    ownerState: { color: "primary" },
  });
  expect(defaultIconButton.color).toBe("#C4C7C5");
  expect(defaultIconButton["&:hover"].backgroundColor).toBe("#282A2C");
  expect(
    defaultIconButton["&:hover"]["@media (hover: none)"].backgroundColor
  ).toBe("transparent");
  expect(primaryIconButton.color).toBe(undefined);
  expect(primaryIconButton["&:hover"]).toBe(undefined);
  expect(defaultIconButton["&.Mui-focusVisible"]).toEqual({
    outline: "2px solid #A8C7FA",
    outlineOffset: 2,
  });
  expect(
    capturedTheme.components.MuiSlider.styleOverrides.thumb[
      "&.Mui-focusVisible"
    ]
  ).toMatchObject({ outline: "2px solid #A8C7FA", outlineOffset: 2 });
  expect(
    capturedTheme.components.MuiRadio.styleOverrides.root["&.Mui-focusVisible"]
  ).toMatchObject({ outline: "2px solid #A8C7FA", outlineOffset: 0 });
  expect(
    capturedTheme.components.MuiToggleButton.styleOverrides.root[
      "&.Mui-selected"
    ]
  ).toMatchObject({
    backgroundColor: "#004A77",
    color: "#C2E7FF",
  });
  expect(
    capturedTheme.components.MuiListItemButton.styleOverrides.root[
      "&&.Mui-focusVisible"
    ].boxShadow
  ).toBe("inset 0 0 0 2px #A8C7FA");
  expect(
    capturedTheme.components.MuiAccordionSummary.styleOverrides.root[
      "&&.Mui-focusVisible"
    ].boxShadow
  ).toBe("inset 0 0 0 2px #A8C7FA");
  expect(
    capturedTheme.components.MuiLoadingButton.styleOverrides.loadingIndicator
      .color
  ).toBe("#A8C7FA");
  expect(
    capturedTheme.components.MuiDialog.styleOverrides.paper.borderRadius
  ).toBe(M3_RADIUS_2XL);
  expect(
    capturedTheme.components.MuiMenu.styleOverrides.paper.borderRadius
  ).toBe(M3_RADIUS_XL);
  expect(
    capturedTheme.components.MuiMenu.styleOverrides.paper.boxShadow
  ).toBe("var(--kt-shadow-menu)");
  expect(
    capturedTheme.components.MuiPopover.styleOverrides.paper.borderRadius
  ).toBe(M3_RADIUS_XL);
  expect(
    capturedTheme.components.MuiTooltip.styleOverrides.tooltip.borderRadius
  ).toBe(M3_RADIUS_CHIP);
  expect(
    capturedTheme.components.MuiBackdrop.styleOverrides.root[
      "@media (prefers-reduced-motion: reduce)"
    ].transitionDuration
  ).toBe("0.01ms !important");
  expect(
    getComputedStyle(container.querySelector('[aria-label="default icon"]'))
      .color
  ).toBe("rgb(196, 199, 197)");
  expect(
    getComputedStyle(container.querySelector('[aria-label="primary icon"]'))
      .color
  ).toBe("rgb(168, 199, 250)");

  act(() => root.unmount());
  container.remove();
});

test.each(["object", "callback"])(
  "compact %s typography keeps M3 defaults and generates pixel sizes on small-root pages",
  (kind) => {
    const originalFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = "10px";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const typography = {
      pxToRem: (size) => `${size}px`,
      body1: { fontSize: 14 },
      body2: { fontSize: 13 },
      caption: { fontSize: 12 },
      button: { fontSize: 13 },
    };

    try {
      act(() => {
        root.render(
          <M3Theme
            options={{
              typography: kind === "callback" ? () => typography : typography,
            }}
          >
            <Typography variant="h6">Heading</Typography>
            <Typography variant="body1" id="compact-body">
              Body
            </Typography>
            <Typography variant="body2" id="compact-detail">
              Detail
            </Typography>
            <Typography variant="caption" id="compact-caption">
              Caption
            </Typography>
            <Button>Action</Button>
          </M3Theme>
        );
      });

      const style = (selector) =>
        getComputedStyle(container.querySelector(selector));
      expect(style("h6").fontSize).toBe("20px");
      expect(style("#compact-body").fontSize).toBe("14px");
      expect(style("#compact-detail").fontSize).toBe("13px");
      expect(style("#compact-caption").fontSize).toBe("12px");
      expect(style("button").fontSize).toBe("13px");
      expect(style("button").fontFamily.replace(/,\s*/g, ",")).toBe(
        M3_FONT_FAMILY.replace(/,\s*/g, ",")
      );
      expect(style("button").fontWeight).toBe("650");
      expect(style("button").textTransform).toBe("none");
    } finally {
      act(() => root.unmount());
      container.remove();
      document.documentElement.style.fontSize = originalFontSize;
    }
  }
);

test("partial component options preserve M3 button defaults and focus treatment", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    act(() => {
      root.render(
        <M3Theme
          options={{
            components: {
              MuiButton: {
                defaultProps: { size: "small" },
                styleOverrides: {
                  root: { minHeight: 32 },
                  sizeSmall: { fontSize: 12 },
                },
              },
            },
          }}
        >
          <Button>Action</Button>
          <ThemeProbe />
        </M3Theme>
      );
    });

    const button = getComputedStyle(container.querySelector("button"));
    expect(button.minHeight).toBe("32px");
    expect(button.fontSize).toBe("12px");
    expect(button.borderRadius).toBe("999px");
    expect(capturedTheme.components.MuiButton.defaultProps).toMatchObject({
      disableElevation: true,
      size: "small",
    });
    expect(
      capturedTheme.components.MuiButton.styleOverrides.root[
        "&.Mui-focusVisible"
      ]
    ).toEqual({
      outline: "2px solid #A8C7FA",
      outlineOffset: 2,
    });
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

let capturedTheme;

function ThemeProbe() {
  capturedTheme = useTheme();
  return null;
}
