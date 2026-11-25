import IconButton from "@mui/material/IconButton";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import BrightnessAutoRoundedIcon from "@mui/icons-material/BrightnessAutoRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../hooks/I18n";
import { useDarkMode } from "../../hooks/ColorMode";
import { createMenuKeyDownHandler } from "../../libs/menuFocus";
import Logo from "../Logo";

export function getOverflowMenuPosition(anchor, menu, viewport) {
  const margin = 8;
  const gap = 4;
  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const width = Math.min(menu.width, maxWidth);
  const height = Math.min(menu.height, maxHeight);
  const below = viewport.height - margin - anchor.bottom - gap;
  const above = anchor.top - gap - margin;
  const preferredTop =
    height > below && above > below
      ? anchor.top - gap - height
      : anchor.bottom + gap;
  const clamp = (value, max) => Math.max(margin, Math.min(value, max));

  return {
    left: clamp(anchor.right - width, viewport.width - margin - width),
    top: clamp(preferredTop, viewport.height - margin - height),
    maxWidth,
    maxHeight,
  };
}

/**
 * Shared panel header. Optional callbacks expose only actions supported by its host.
 */
export default function TranslationPanelHeader({
  onClose,
  onOpenSeparateWindow,
  draggable = false,
  compact = false,
  simpleStyleDisabled = false,
  simpleStyle,
  setSimpleStyle,
  hideClickAway,
  setHideClickAway,
  followSelection,
  setFollowSelection,
}) {
  const i18n = useI18n();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [showMore, setShowMore] = useState(false);
  const menuId = useId();
  const menuButtonId = `${menuId}-button`;
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const focusLastItemRef = useRef(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const navigateMenu = useMemo(() => createMenuKeyDownHandler(), []);

  const updateMenuPosition = useCallback(() => {
    const menu = menuRef.current;
    const button = menuButtonRef.current;
    if (!menu || !button) return;
    const header = button.closest(".kt-tranbox-header").getBoundingClientRect();
    const ownerWindow = button.ownerDocument.defaultView;
    const position = getOverflowMenuPosition(
      button.getBoundingClientRect(),
      menu.getBoundingClientRect(),
      { width: ownerWindow.innerWidth, height: ownerWindow.innerHeight }
    );
    position.left -= header.left;
    position.top -= header.top;
    setMenuPosition((previous) =>
      previous &&
      Object.keys(position).every((key) => previous[key] === position[key])
        ? previous
        : position
    );
  }, []);

  // Refit when opening the overflow menu or when its positioning callback updates.
  useLayoutEffect(() => {
    if (showMore) updateMenuPosition();
  }, [showMore, updateMenuPosition]);

  useEffect(() => {
    if (!showMore) return;
    const items = menuRef.current?.querySelectorAll(
      '[role^="menuitem"]:not(:disabled)'
    );
    items?.[focusLastItemRef.current ? items.length - 1 : 0]?.focus();
  }, [showMore]);

  useEffect(() => {
    if (!showMore) return;
    const ownerWindow = menuButtonRef.current.ownerDocument.defaultView;
    ownerWindow.addEventListener("resize", updateMenuPosition);
    return () => ownerWindow.removeEventListener("resize", updateMenuPosition);
  }, [showMore, updateMenuPosition]);

  useEffect(() => {
    if (!showMore) return;
    const ownerDocument = menuButtonRef.current.ownerDocument;
    const handleOutsideClick = (event) => {
      const path = event.composedPath();
      if (
        path.includes(menuRef.current) ||
        path.includes(menuButtonRef.current)
      ) {
        return;
      }
      setShowMore(false);
    };

    // Capture clicks before the panel isolates them from the host page. The
    // composed path retains the original target across the selection shadow root.
    ownerDocument.addEventListener("click", handleOutsideClick, true);
    return () =>
      ownerDocument.removeEventListener("click", handleOutsideClick, true);
  }, [showMore]);

  const handleMenuKeyDown = (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      event.stopPropagation();
      setShowMore(false);
      // For Tab, let the browser continue from the trigger in either direction.
      menuButtonRef.current?.focus();
      return;
    }
    navigateMenu(event);
  };

  return (
    // Keep stopPropagation on mouseup: the header also starts drags, and bubbling
    // the release event would interfere with the page's selection handling.
    <div
      className={`kt-tranbox-header${compact ? " kt-tranbox-header--compact" : ""}`}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {draggable && (
        <span className="kt-tranbox-header__drag" aria-hidden="true">
          <DragIndicatorRoundedIcon />
        </span>
      )}

      {/* Left: logo and brand title. */}
      {!compact && (
        <span className="kt-tranbox-header__brand">
          <Logo size={18} className="kt-tranbox-header__logo" />
          <span className="kt-tranbox-header__title">{i18n("app_name")}</span>
        </span>
      )}

      {/* Right: always-visible actions. */}
      <span className="kt-tranbox-header__actions">
        {/* Lock the panel against outside clicks. */}
        {setHideClickAway && (
          <IconButton
            title={i18n("btn_tip_click_away")}
            aria-label={i18n("btn_tip_click_away")}
            aria-pressed={!hideClickAway}
            data-kt-tranbox-lock={String(!hideClickAway)}
            onClick={() => setHideClickAway((pre) => !pre)}
          >
            {hideClickAway ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
          </IconButton>
        )}

        {/* Keep less frequent controls in the overflow menu. */}
        <IconButton
          id={menuButtonId}
          ref={menuButtonRef}
          title={i18n("more")}
          aria-label={i18n("more")}
          aria-expanded={showMore}
          aria-haspopup="menu"
          aria-controls={showMore ? menuId : undefined}
          onClick={() => {
            focusLastItemRef.current = false;
            setShowMore((pre) => !pre);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            event.stopPropagation();
            focusLastItemRef.current = event.key === "ArrowUp";
            setShowMore(true);
          }}
        >
          <MoreVertRoundedIcon />
        </IconButton>

        {/* Close the translation panel. */}
        {onClose && (
          <IconButton
            title={i18n("close")}
            aria-label={i18n("close")}
            onClick={onClose}
          >
            <CloseRoundedIcon />
          </IconButton>
        )}
      </span>

      {showMore && (
        <div
          ref={menuRef}
          id={menuId}
          className="kt-tranbox-header__menu"
          style={menuPosition ? { ...menuPosition, right: "auto" } : undefined}
          role="menu"
          aria-labelledby={menuButtonId}
          onKeyDown={handleMenuKeyDown}
        >
          {/* Open in a separate window. */}
          {onOpenSeparateWindow && (
            <button
              type="button"
              tabIndex={-1}
              role="menuitem"
              onClick={onOpenSeparateWindow}
            >
              <OpenInNewRoundedIcon />
              {i18n("open_separate_window")}
            </button>
          )}

          {/* Toggle the minimal collapsed style. */}
          {setSimpleStyle && (
            <button
              type="button"
              tabIndex={-1}
              role="menuitemcheckbox"
              aria-checked={simpleStyle}
              disabled={simpleStyleDisabled}
              onClick={() => {
                setShowMore(false);
                // Collapsing removes the input; expansion will focus it again.
                menuButtonRef.current?.focus();
                setSimpleStyle((pre) => !pre);
              }}
            >
              {simpleStyle ? (
                <UnfoldMoreRoundedIcon />
              ) : (
                <UnfoldLessRoundedIcon />
              )}
              {i18n("btn_tip_simple_style")}
            </button>
          )}

          {/* Toggle between a fixed position and following the selection. */}
          {setFollowSelection && (
            <button
              type="button"
              tabIndex={-1}
              role="menuitemcheckbox"
              aria-checked={followSelection}
              onClick={() => setFollowSelection((pre) => !pre)}
            >
              {followSelection ? (
                <PushPinOutlinedIcon />
              ) : (
                <PushPinRoundedIcon />
              )}
              {i18n("btn_tip_follow_selection")}
            </button>
          )}

          {/* Cycle through dark, light, and automatic themes. */}
          <button
            type="button"
            tabIndex={-1}
            role="menuitem"
            onClick={toggleDarkMode}
          >
            {darkMode === "dark" ? (
              <DarkModeRoundedIcon />
            ) : darkMode === "auto" ? (
              <BrightnessAutoRoundedIcon />
            ) : (
              <LightModeRoundedIcon />
            )}
            {i18n("btn_tip_dark_mode")}
          </button>
        </div>
      )}
    </div>
  );
}
