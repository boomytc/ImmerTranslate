import { useMemo, useRef } from "react";
import { TextField } from "@mui/material";
import { createMenuKeyDownHandler } from "../../libs/menuFocus";
import { getEditorPortalContainer } from "./portal";

// Shared dropdown surface across EditorSelect and Autocomplete in RuleEditor.
export const EDITOR_MENU_PAPER_SX = {
  overscrollBehavior: "contain",
  border: "1px solid",
  borderColor: "var(--kt-linev)",
  borderRadius: "var(--kt-radius-surface, 12px)",
  bgcolor: "var(--kt-sf0)",
  color: "var(--kt-on)",
  boxShadow: "var(--kt-shadow-menu)",
  WebkitBackdropFilter: "none",
  backdropFilter: "none",
};

// Keep the menu in the editor's shadow tree so Emotion styles and page
// isolation apply to both the field and its popup.
export default function EditorSelect({ sx, ...props }) {
  const field = useRef(null);
  const navigateMenu = useMemo(
    () =>
      createMenuKeyDownHandler({
        shadowOnly: true,
        disableListWrap: true,
      }),
    []
  );
  return (
    <TextField
      {...props}
      ref={field}
      select
      fullWidth
      size="small"
      variant="filled"
      sx={[
        { "& .MuiFilledInput-root": { minHeight: 40 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      SelectProps={{
        MenuProps: {
          container: () => getEditorPortalContainer(field.current),
          disableScrollLock: true,
          // The document sees the shadow host as activeElement. MUI's modal
          // focus trap would otherwise pull focus away from the menu options.
          disableEnforceFocus: true,
          disableAutoFocus: true,
          MenuListProps: {
            onKeyDownCapture: navigateMenu,
            sx: { p: 0.5 },
          },
          sx: { zIndex: 2147483647 },
          PaperProps: {
            elevation: 0,
            sx: {
              ...EDITOR_MENU_PAPER_SX,
              "& .MuiMenuItem-root": {
                minHeight: 36,
                borderRadius: "var(--kt-radius-sm, 6px)",
                fontSize: "var(--kt-text-body, 14px)",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                "&.Mui-selected": {
                  bgcolor: "var(--kt-pric)",
                  color: "var(--kt-onpric)",
                  fontWeight: 600,
                },
                "&.Mui-selected:hover": {
                  bgcolor: "var(--kt-pric)",
                },
              },
            },
          },
        },
      }}
    />
  );
}
