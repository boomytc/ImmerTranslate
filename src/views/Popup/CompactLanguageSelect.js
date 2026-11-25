import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useRef } from "react";

function splitLanguageName(name) {
  const normalized = String(name || "");
  const [primary, ...secondaryParts] = normalized.split(" - ");
  const secondary = secondaryParts.join(" - ").trim();
  return {
    primary,
    secondary:
      secondary && secondary.toLocaleLowerCase() !== primary.toLocaleLowerCase()
        ? secondary
        : "",
  };
}

export default function CompactLanguageSelect({
  ariaLabel,
  value,
  options = [],
  onChange,
}) {
  const selectRef = useRef(null);
  const normalizedValue = value ?? "";
  const safeOptions =
    normalizedValue !== "" && !options.some(([key]) => key === normalizedValue)
      ? [[normalizedValue, String(normalizedValue)], ...options]
      : options;

  return (
    <Select
      ref={selectRef}
      className="kt-popup-language-select"
      value={normalizedValue}
      variant="standard"
      disableUnderline
      inputProps={{ "aria-label": ariaLabel }}
      renderValue={(selectedValue) => {
        const selectedName =
          safeOptions.find(([key]) => key === selectedValue)?.[1] ??
          selectedValue;
        const { primary, secondary } = splitLanguageName(selectedName);
        const displayName = secondary ? `${primary} - ${secondary}` : primary;
        return (
          <span className="kt-popup-language-value" title={displayName}>
            <span className="kt-popup-language-value__primary">{primary}</span>
          </span>
        );
      }}
      MenuProps={{
        container: () => selectRef.current?.closest(".kt-m3-root"),
        disableScrollLock: true,
        sx: { zIndex: 2147483647 },
        PaperProps: {
          className: "kt-popup-language-menu",
          elevation: 0,
        },
        MenuListProps: {
          dense: true,
        },
      }}
      onChange={onChange}
    >
      {safeOptions.map(([key, name]) => {
        const { primary, secondary } = splitLanguageName(name);
        return (
          <MenuItem key={key} value={key}>
            {secondary ? `${primary} - ${secondary}` : primary}
          </MenuItem>
        );
      })}
    </Select>
  );
}
