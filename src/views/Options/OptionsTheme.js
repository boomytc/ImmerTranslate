import M3Theme from "../../hooks/M3Theme";
import {
  SETTINGS_FONT_SIZE,
  SETTINGS_HEADING_SIZE,
  SETTINGS_HELPER_FONT_SIZE,
} from "./typography";

export { getMuiSwitchStyleOverrides } from "../../hooks/M3Theme";

const toRem = (px) => `${px / 16}rem`;

// Theme values also reach menus and dialogs rendered outside the page shell.
const OPTIONS_THEME = {
  typography: {
    h6: { fontSize: toRem(SETTINGS_HEADING_SIZE), fontWeight: 600 },
    subtitle1: { fontSize: toRem(SETTINGS_HEADING_SIZE), fontWeight: 600 },
    body1: { fontSize: toRem(SETTINGS_FONT_SIZE) },
    body2: { fontSize: toRem(SETTINGS_FONT_SIZE) },
    button: { fontSize: toRem(SETTINGS_FONT_SIZE), fontWeight: 600 },
    caption: { fontSize: toRem(SETTINGS_HELPER_FONT_SIZE) },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 36, fontSize: toRem(SETTINGS_FONT_SIZE) },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { minHeight: 36, fontSize: toRem(SETTINGS_FONT_SIZE) },
      },
    },
    MuiToggleButton: {
      styleOverrides: { root: { fontSize: toRem(SETTINGS_FONT_SIZE) } },
    },
    MuiInputLabel: {
      styleOverrides: {
        // MUI scales floating labels by 0.75, keeping the visual size at 13px.
        shrink: { fontSize: toRem(SETTINGS_HELPER_FONT_SIZE / 0.75) },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: toRem(SETTINGS_HELPER_FONT_SIZE), lineHeight: 1.45 },
      },
    },
  },
};

export default function OptionsTheme({ children }) {
  return (
    <M3Theme options={OPTIONS_THEME} standaloneRoot>
      {children}
    </M3Theme>
  );
}
