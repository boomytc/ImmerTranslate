import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { DEFAULT_FAB, normalizeFabAppearance } from "../../config/fab";
import { TRANBTN_SIZE } from "../../hooks/useSelectionController";

/**
 * Floating trigger shown next to a page selection.
 *
 * @param {Object} props
 * @param {Function} props.onTrigger - Translation trigger callback.
 * @param {string} props.btnEvent - React event prop used for activation.
 * @param {Object} props.position - Final viewport coordinates as { x, y }.
 * @param {string} props.label - Accessible button label.
 * @param {number} props.size - Button size in pixels (aligned with FAB size).
 */
export default function TranBtn({
  onTrigger,
  btnEvent,
  position,
  label = "Translate selection",
  size = TRANBTN_SIZE,
}) {
  const buttonSize =
    typeof size === "number" && Number.isFinite(size)
      ? normalizeFabAppearance({ size }).size
      : TRANBTN_SIZE;
  const iconSize = Math.max(16, (buttonSize * 24) / DEFAULT_FAB.size);

  const dynamicTriggerProps =
    btnEvent === "onClick" ? {} : { [btnEvent]: onTrigger };

  const handleClick = (event) => {
    if (btnEvent === "onClick" || event.detail === 0) {
      onTrigger(event);
    }
  };

  return (
    <button
      type="button"
      className="KT-tranbtn"
      aria-label={label}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 2147483647,
        width: `${buttonSize}px`,
        height: `${buttonSize}px`,
        minWidth: `${buttonSize}px`,
        minHeight: `${buttonSize}px`,
        borderRadius: `${buttonSize / 2}px`,
        "--kt-tranbtn-size": `${buttonSize}px`,
        "--kt-tranbtn-icon-size": `${iconSize}px`,
      }}
      // Preserve the page selection while activating the trigger.
      onMouseDown={(e) => e.preventDefault()}
      {...dynamicTriggerProps}
      onClick={handleClick}
    >
      <TranslateRoundedIcon
        aria-hidden="true"
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          fontSize: `${iconSize}px`,
        }}
      />
    </button>
  );
}
