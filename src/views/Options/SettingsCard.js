import {
  Children,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useI18n } from "../../hooks/I18n";

const SettingsRowContext = createContext(null);

export function SettingsSection({ title, action, children, className = "" }) {
  return (
    <section className={`kt-settings-section ${className}`.trim()}>
      {(title || action) && (
        <div className="kt-settings-section__header">
          {title && <h2>{title}</h2>}
          {action && (
            <div className="kt-settings-section__action">{action}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function SettingsCard({ children, className = "" }) {
  return (
    <Box component="ul" className={`kt-settings-card ${className}`.trim()}>
      {children}
    </Box>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  stacked = false,
  className = "",
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const descId = description ? `${baseId}-desc` : undefined;
  const controlId = `${baseId}-control`;
  const childArray = Children.toArray(children);
  const singleChild = childArray.length === 1 ? childArray[0] : null;
  // Only native <input> controls (SettingsSwitch) are HTML-labelable via <label htmlFor>.
  const hasNativeInputControl = Boolean(
    singleChild && singleChild.type === SettingsSwitch
  );

  return (
    <SettingsRowContext.Provider
      value={{
        controlId,
        labelId,
        descId,
        hasHtmlLabel: hasNativeInputControl,
      }}
    >
      <ListItem
        disableGutters
        className={`kt-settings-row ${stacked ? "kt-settings-row--stacked" : ""} ${className}`.trim()}
      >
        <div className="kt-settings-row__copy">
          {hasNativeInputControl ? (
            <label
              id={labelId}
              htmlFor={controlId}
              className="kt-settings-row__label"
            >
              {label}
            </label>
          ) : (
            <span id={labelId} className="kt-settings-row__label">
              {label}
            </span>
          )}
          {description && (
            <span id={descId} className="kt-settings-row__desc">
              {description}
            </span>
          )}
        </div>
        <Box className="kt-settings-row__control">{children}</Box>
      </ListItem>
    </SettingsRowContext.Provider>
  );
}

export function SettingsSwitch({ checked, onChange, label, disabled = false }) {
  const rowContext = useContext(SettingsRowContext);
  return (
    <Switch
      id={rowContext?.hasHtmlLabel ? rowContext.controlId : undefined}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      inputProps={{
        "aria-label": rowContext ? undefined : label,
        "aria-labelledby":
          rowContext && !rowContext.hasHtmlLabel
            ? rowContext.labelId
            : undefined,
        "aria-describedby": rowContext?.descId,
      }}
    />
  );
}

export function SettingsSegmented({
  value,
  onChange,
  items,
  label,
  className = "",
}) {
  const rowContext = useContext(SettingsRowContext);
  const itemRefs = useRef([]);
  const normalizedItems = items.map((item) =>
    typeof item === "object" ? item : { value: item, label: String(item) }
  );
  const enabledIndexes = normalizedItems.reduce((indexes, item, index) => {
    if (!item.disabled) indexes.push(index);
    return indexes;
  }, []);
  const selectedIndex = normalizedItems.findIndex(
    (item) => !item.disabled && item.value === value
  );
  const tabbableIndex =
    selectedIndex === -1 ? (enabledIndexes[0] ?? -1) : selectedIndex;

  const handleKeyDown = (event, currentIndex) => {
    let targetIndex;

    if (event.key === "Home") {
      targetIndex = enabledIndexes[0];
    } else if (event.key === "End") {
      targetIndex = enabledIndexes[enabledIndexes.length - 1];
    } else {
      const direction = {
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -1,
      }[event.key];

      if (direction === undefined || enabledIndexes.length === 0) return;

      const currentPosition = enabledIndexes.indexOf(currentIndex);
      const nextPosition =
        (currentPosition + direction + enabledIndexes.length) %
        enabledIndexes.length;
      targetIndex = enabledIndexes[nextPosition];
    }

    if (targetIndex === undefined) return;

    event.preventDefault();
    itemRefs.current[targetIndex]?.focus();
    const nextValue = normalizedItems[targetIndex].value;
    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_event, nextValue) => {
        if (nextValue !== null) onChange(nextValue);
      }}
      className={`kt-settings-segmented ${className}`.trim()}
      aria-label={rowContext ? undefined : label}
      aria-labelledby={rowContext?.labelId}
      aria-describedby={rowContext?.descId}
      role="radiogroup"
    >
      {normalizedItems.map((normalized, index) => {
        const selected = normalized.value === value;
        return (
          <ToggleButton
            value={normalized.value}
            disabled={Boolean(normalized.disabled)}
            role="radio"
            aria-checked={selected}
            aria-pressed={undefined}
            aria-label={
              typeof normalized.label === "string"
                ? normalized.label
                : undefined
            }
            tabIndex={index === tabbableIndex ? 0 : -1}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            key={normalized.value}
          >
            <span className="kt-settings-segmented__label">
              {normalized.label}
            </span>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}

export function SettingsSelect({
  value,
  onChange,
  options,
  label,
  multiple = false,
  disabled = false,
}) {
  const rowContext = useContext(SettingsRowContext);
  return (
    <TextField
      select
      hiddenLabel
      size="small"
      variant="filled"
      className="kt-settings-select"
      value={value}
      disabled={disabled}
      SelectProps={{
        multiple,
        SelectDisplayProps: {
          "aria-labelledby": rowContext?.labelId,
          "aria-describedby": rowContext?.descId,
        },
      }}
      inputProps={{ "aria-label": rowContext ? undefined : label }}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => {
        const normalized = Array.isArray(option)
          ? { value: option[0], label: option[1] }
          : option;
        return (
          <MenuItem key={normalized.value} value={normalized.value}>
            {normalized.label}
          </MenuItem>
        );
      })}
    </TextField>
  );
}

export function SettingsRange({
  value,
  min,
  max,
  step = 1,
  unit = "",
  label,
  onChange,
}) {
  const rowContext = useContext(SettingsRowContext);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  return (
    <Box className="kt-settings-range">
      <Slider
        value={draftValue}
        min={min}
        max={max}
        step={step}
        aria-label={rowContext ? undefined : label}
        aria-labelledby={rowContext?.labelId}
        aria-describedby={rowContext?.descId}
        onChange={(_event, nextValue) => setDraftValue(Number(nextValue))}
        onChangeCommitted={(_event, nextValue) => onChange(Number(nextValue))}
      />
      <Typography
        component="output"
        className="kt-settings-range__output"
      >{`${draftValue}${unit}`}</Typography>
    </Box>
  );
}

export function ShortcutKeys({ keys = [] }) {
  const i18n = useI18n();
  if (keys.length === 0) {
    return (
      <span className="kt-settings-keys kt-settings-keys--empty">
        {i18n("not_set")}
      </span>
    );
  }

  return (
    <span className="kt-settings-keys" aria-label={keys.join("+")}>
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}

export function SettingsDisclosure({
  label,
  children,
  defaultOpen = false,
  className = "",
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `kt-settings-disclosure-${id}`;

  return (
    <div
      className={`kt-settings-disclosure ${
        open ? "kt-settings-disclosure--open" : ""
      } ${className}`.trim()}
    >
      <button
        type="button"
        className="kt-settings-disclosure__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ExpandMoreRoundedIcon
          className="kt-settings-disclosure__icon"
          aria-hidden="true"
        />
        <span>{label}</span>
      </button>
      {open && (
        <div id={panelId} className="kt-settings-disclosure__content">
          {children}
        </div>
      )}
    </div>
  );
}

export function SettingsAdvanced({
  label,
  children,
  open = false,
  rows = false,
  className = "",
}) {
  const id = useId();
  const summaryId = `kt-settings-advanced-summary-${id}`;
  const regionId = `kt-settings-advanced-region-${id}`;
  const [expanded, setExpanded] = useState(open);
  const [hasExpanded, setHasExpanded] = useState(open);

  useEffect(() => {
    setExpanded(open);
    if (open) setHasExpanded(true);
  }, [open]);

  const handleChange = (_event, nextExpanded) => {
    setExpanded(nextExpanded);
    if (nextExpanded) setHasExpanded(true);
  };

  return (
    <Box
      className={`kt-settings-advanced-shell ${
        rows ? "kt-settings-advanced-shell--rows" : ""
      } ${className}`.trim()}
    >
      <Accordion
        disableGutters
        expanded={expanded}
        onChange={handleChange}
        className="kt-settings-advanced"
      >
        <AccordionSummary
          id={summaryId}
          aria-controls={regionId}
          expandIcon={<ExpandMoreRoundedIcon />}
        >
          {label}
        </AccordionSummary>
        <AccordionDetails
          id={regionId}
          className="kt-settings-advanced__content"
        >
          {rows ? (
            <Box component="ul" className="kt-settings-advanced__rows">
              {hasExpanded ? children : null}
            </Box>
          ) : hasExpanded ? (
            children
          ) : null}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
