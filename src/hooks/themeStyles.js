export function getMuiSwitchStyleOverrides(color) {
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  return {
    root: {
      width: 44,
      height: 24,
      padding: 0,
      overflow: "visible",
      "&.MuiSwitch-sizeSmall .MuiSwitch-switchBase.Mui-checked": {
        transform: "translateX(20px)",
      },
    },
    switchBase: {
      width: 24,
      height: 24,
      display: "grid",
      placeItems: "center",
      top: 0,
      left: 0,
      padding: 0,
      color: color.outline,
      transform: "translateX(0)",
      transition: `color 150ms ${ease}, background-color 150ms ${ease}`,
      "@media (prefers-reduced-motion: no-preference)": {
        transition: `transform 150ms ${ease}, color 150ms ${ease}, background-color 150ms ${ease}`,
      },
      "&:not(.Mui-disabled):hover": {
        backgroundColor: `color-mix(in oklab, ${color.onSurface} 8%, transparent)`,
      },
      "&.Mui-focusVisible": {
        outline: `2px solid ${color.primary}`,
        outlineOffset: 2,
        "@media (forced-colors: active)": {
          outline: "2px solid Highlight",
        },
      },
      "&.Mui-checked": {
        padding: 0,
        transform: "translateX(20px)",
        color: color.onPrimary,
        "& + .MuiSwitch-track": {
          borderColor: color.primary,
          backgroundColor: color.primary,
          opacity: 1,
        },
        "& .MuiSwitch-thumb": {
          transform: "scale(1)",
        },
        "& .MuiSwitch-input": {
          left: -20,
        },
        "&:not(.Mui-disabled):hover": {
          backgroundColor: `color-mix(in oklab, ${color.primary} 12%, transparent)`,
        },
      },
      "&.Mui-disabled": {
        color: color.onSurface,
        "& .MuiSwitch-thumb": { opacity: 0.38 },
        "& + .MuiSwitch-track": {
          borderColor: color.onSurface,
          backgroundColor: color.onSurface,
          opacity: 0.14,
        },
      },
      "&.Mui-checked.Mui-disabled": {
        color: color.surface,
        "& .MuiSwitch-thumb": { opacity: 1 },
        "& + .MuiSwitch-track": {
          borderColor: color.onSurface,
          backgroundColor: color.onSurface,
          opacity: 0.16,
        },
      },
    },
    input: {
      left: 0,
      width: 44,
      height: 24,
      borderRadius: 999,
    },
    thumb: {
      width: 18,
      height: 18,
      boxShadow: "none",
      transform: "scale(0.76)",
      transition: `opacity 150ms ${ease}`,
      "@media (prefers-reduced-motion: no-preference)": {
        transition: `transform 150ms ${ease}, opacity 150ms ${ease}`,
      },
    },
    track: {
      border: `1.5px solid ${color.outline}`,
      borderRadius: 999,
      backgroundColor: color.surfaceContainer,
      opacity: 1,
      transition: `background-color 150ms ${ease}, border-color 150ms ${ease}, opacity 150ms ${ease}`,
    },
  };
}
