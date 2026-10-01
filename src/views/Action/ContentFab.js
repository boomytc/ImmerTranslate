import { supportsTouch } from "../../libs/touchCapability";
import TouchTranslateControl from "../../components/TouchTranslateControl";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import ThemeProvider from "../../hooks/M3Theme";
import Draggable from "./Draggable";
import { SettingProvider } from "../../hooks/Setting";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import {
  DEFAULT_FAB,
  EVENT_KISS_INNER,
  MSG_FAB_TOGGLE,
  MSG_OPEN_OPTIONS,
  MSG_OPEN_TRANBOX,
  MSG_POPUP_TOGGLE,
  MSG_TRANS_CURRULE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_STYLE,
  MSG_TRANSBOX_TOGGLE,
  OPT_STYLE_NONE,
  STOKEY_FAB,
} from "../../config";
import { useI18n } from "../../hooks/I18n";
import { getStorageState } from "../../libs/storageState";
import { isExt } from "../../libs/client";
import { kissLog } from "../../libs/log";
import { sendBgMsg } from "../../libs/msg";
import { createMenuKeyDownHandler } from "../../libs/menuFocus";
import useWindowSize from "../../hooks/WindowSize";
import { useFullscreenDetect } from "../../hooks/useFullscreenDetect";
import { ACTION_STYLES } from "./styles";
import {
  normalizeFabAppearance,
  isFabVisible,
  FAB_MAX_SIZE,
  FAB_MIN_SIZE,
} from "../../config/fab";
import { isMatch } from "../../libs/utils";
import FloatingButton from "../../components/FloatingButton";
import FabQuickOptions from "./FabQuickOptions";

const selectionUnavailable = () => false;

function subscribeSelectionEnabled(onChange) {
  const handleChange = (event) => {
    if (event.detail?.action === MSG_TRANSBOX_TOGGLE) onChange();
  };
  document.addEventListener(EVENT_KISS_INNER, handleChange);
  return () => document.removeEventListener(EVENT_KISS_INNER, handleChange);
}

// Flip and shift the menu near viewport edges. The FAB can reach any corner,
// so fallback placements cover all sides to prevent clipping.
export const FAB_POPPER_MODIFIERS = [
  {
    name: "flip",
    enabled: true,
    options: {
      fallbackPlacements: [
        "top-start",
        "bottom-end",
        "bottom-start",
        "left-start",
        "left-end",
        "right-start",
        "right-end",
        "top",
        "bottom",
        "left",
        "right",
      ],
      boundary: "viewport",
      padding: 12,
    },
  },
  {
    name: "preventOverflow",
    enabled: true,
    options: {
      padding: 12,
      boundary: "viewport",
      altAxis: true,
      tether: false,
    },
  },
  { name: "offset", options: { offset: [0, 10] } },
];

/**
 * Floating translation action button for content pages.
 * Supports dragging, edge snapping, and a Material 3 action menu.
 */
export function ContentFabContent({
  fabConfig = {},
  processActions,
  getSelectionEnabled = selectionUnavailable,
  getFabPageState,
}) {
  const i18n = useI18n();
  const {
    x: fabX,
    y: fabY,
    edge: fabEdge,
    fabClickAction = 0,
  } = fabConfig || {};
  const [localSize, setLocalSize] = useState(null);
  const {
    halfHide,
    opacity,
    size: baseFabSize,
  } = normalizeFabAppearance(fabConfig);
  const fabSize = localSize ?? baseFabSize;

  const handleSizeChange = useCallback(
    (newSize) => {
      const clamped = Math.round(
        Math.min(FAB_MAX_SIZE, Math.max(FAB_MIN_SIZE, newSize))
      );
      setLocalSize(clamped);
      void processActions?.({
        action: MSG_FAB_TOGGLE,
        args: {
          fabConfig: { size: clamped },
        },
      });
      void getStorageState(STOKEY_FAB, DEFAULT_FAB).save((previous) => ({
        ...(previous || DEFAULT_FAB),
        size: clamped,
      }));
    },
    [processActions]
  );
  // Use the current tab's runtime state, which can differ from stored settings.
  const selectionEnabled = useSyncExternalStore(
    subscribeSelectionEnabled,
    getSelectionEnabled
  );
  const opensMenu = fabClickAction !== 1;
  const windowSize = useWindowSize();
  const [moved, setMoved] = useState(false); // Track whether a drag occurred.
  const [showFab, setShowFab] = useState(true);
  const [touchOpen, setTouchOpen] = useState(false);
  const [open, setOpen] = useState(false); // Action menu visibility.
  const [pageRule, setPageRule] = useState(null);
  const [undoToast, setUndoToast] = useState({ open: false, domain: "" });
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const popperRef = useRef(null);
  const undoTimerRef = useRef(null);
  const pendingDomainRef = useRef("");
  const savedConfirmedRef = useRef(false);
  const removedExceptionsRef = useRef([]);
  const handleMenuNavigation = useMemo(
    () => createMenuKeyDownHandler({ shadowOnly: true }),
    []
  );
  const { isVideoFullscreen } = useFullscreenDetect();

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!getFabPageState) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await getFabPageState();
        if (active && response?.rule) setPageRule(response.rule);
      } catch {
        // The action list stays usable when the page rule cannot be read.
      }
    })();
    return () => {
      active = false;
    };
  }, [getFabPageState]);

  useEffect(() => {
    const onRule = (event) => {
      if (event.detail?.action !== MSG_TRANS_CURRULE || !event.detail.rule) {
        return;
      }
      setPageRule(event.detail.rule);
    };
    document.addEventListener(EVENT_KISS_INNER, onRule);
    return () => document.removeEventListener(EVENT_KISS_INNER, onRule);
  }, []);

  useEffect(() => {
    setShowFab(!isVideoFullscreen);
    // Close the menu when video fullscreen hides the FAB,
    // preventing an orphaned panel that cannot be reached or dismissed.
    if (isVideoFullscreen) {
      setOpen(false);
    }
  }, [isVideoFullscreen]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) anchorRef.current?.focus();
  }, []);

  const handleHideOnSite = useCallback(async () => {
    closeMenu();
    setShowFab(false);
    const domain = window.location?.hostname || "";
    const href = window.location?.href || "";
    pendingDomainRef.current = domain;
    savedConfirmedRef.current = false;
    removedExceptionsRef.current = [];
    let savedConfig;
    let removedEntries = [];
    if (domain) {
      try {
        const fabState = getStorageState(STOKEY_FAB, DEFAULT_FAB);
        const receipt = await fabState.save((previous) => {
          const current =
            typeof previous === "object" && previous !== null
              ? previous
              : DEFAULT_FAB;
          const currentIsHide = Boolean(current?.isHide);
          const entries = (current.hideExceptionList || "")
            .split(/\n|,/)
            .map((entry) => entry.trim())
            .filter(Boolean);

          let nextEntries;
          if (currentIsHide) {
            removedEntries = entries.filter(
              (entry) => entry === domain || isMatch(href, entry)
            );
            nextEntries = entries.filter(
              (entry) => entry !== domain && !isMatch(href, entry)
            );
          } else {
            removedEntries = [];
            nextEntries = entries.includes(domain)
              ? entries
              : [...entries, domain];
          }
          return {
            ...current,
            hideExceptionList: nextEntries.join("\n"),
          };
        });
        if (receipt?.value && typeof receipt.value === "object") {
          savedConfig = receipt.value;
        }
        removedExceptionsRef.current = removedEntries;
      } catch (e) {
        kissLog("hide fab on site error", e);
        pendingDomainRef.current = "";
        setShowFab(true);
        setUndoToast({ open: true, domain: "", error: true });
        return;
      }
    }
    setUndoToast({ open: true, domain });
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      pendingDomainRef.current = "";
      savedConfirmedRef.current = false;
      setUndoToast({ open: false, domain: "" });
      // 撤销条卸载时会清掉这个计时器。配置必须提前进入管理器，
      // 否则 SPA 重建仍用旧名单把悬浮球挂回来。
      void processActions?.({
        action: MSG_FAB_TOGGLE,
        args: savedConfig
          ? { enabled: false, fabConfig: savedConfig }
          : { enabled: false },
      });
    }, 4500);
    if (savedConfig) {
      void processActions?.({
        action: MSG_FAB_TOGGLE,
        args: { enabled: true, fabConfig: savedConfig },
      });
    }
  }, [closeMenu, processActions]);

  const handleUndoHide = useCallback(async () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const domain =
      pendingDomainRef.current ||
      undoToast.domain ||
      window.location?.hostname ||
      "";
    const href = window.location?.href || "";
    const removedEntries = removedExceptionsRef.current;
    let restoredConfig;
    if (domain) {
      try {
        const fabState = getStorageState(STOKEY_FAB, DEFAULT_FAB);
        const receipt = await fabState.save((previous) => {
          const current =
            typeof previous === "object" && previous !== null
              ? previous
              : DEFAULT_FAB;
          const currentIsHide = Boolean(current?.isHide);
          const entries = (current.hideExceptionList || "")
            .split(/\n|,/)
            .map((entry) => entry.trim())
            .filter(Boolean);

          let nextEntries;
          if (currentIsHide) {
            // Restore every exception removed by this hide, while retaining
            // entries added elsewhere during the undo window.
            const restore = removedEntries.length ? removedEntries : [domain];
            nextEntries = [...new Set([...entries, ...restore])];
          } else {
            nextEntries = entries.filter(
              (entry) => entry !== domain && !isMatch(href, entry)
            );
          }
          return {
            ...current,
            hideExceptionList: nextEntries.join("\n"),
          };
        });
        if (receipt?.value && typeof receipt.value === "object") {
          restoredConfig = receipt.value;
        }
      } catch (e) {
        kissLog("undo hide fab error", e);
        setUndoToast({ open: true, domain, error: true });
        return;
      }
    }
    pendingDomainRef.current = "";
    savedConfirmedRef.current = false;
    removedExceptionsRef.current = [];
    setUndoToast({ open: false, domain: "" });
    setShowFab(true);
    if (restoredConfig) {
      void processActions?.({
        action: MSG_FAB_TOGGLE,
        args: { enabled: true, fabConfig: restoredConfig },
      });
    }
  }, [processActions, undoToast.domain]);

  useEffect(() => {
    if (!undoToast.open) {
      savedConfirmedRef.current = false;
      return;
    }
    const domain =
      pendingDomainRef.current ||
      undoToast.domain ||
      window.location?.hostname ||
      "";
    if (!domain) return;
    const href = window.location?.href || "";

    const fabStorage = getStorageState(STOKEY_FAB, DEFAULT_FAB);
    return fabStorage.subscribe((snapshot) => {
      if (snapshot?.isLoading || snapshot?.isSaving || snapshot?.isRecovering) {
        return;
      }
      const data = snapshot?.data;
      const isVisibleNow = isFabVisible(href, data);

      if (!isVisibleNow) {
        savedConfirmedRef.current = true;
      } else if (savedConfirmedRef.current) {
        savedConfirmedRef.current = false;
        if (undoTimerRef.current) {
          window.clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }
        pendingDomainRef.current = "";
        setUndoToast({ open: false, domain: "" });
        setShowFab(true);
      }
    });
  }, [undoToast.domain, undoToast.open]);

  useEffect(() => {
    if (!opensMenu || !open) return;

    const ownerDocument = anchorRef.current.ownerDocument;
    let touchMoved = false;
    // Draggable surfaces stop bubbling events. Capture native events and use
    // their composed paths to identify the menu and FAB across shadow roots.
    const handleClickAway = (event) => {
      const path = event.composedPath();
      if (
        path.includes(menuRef.current) ||
        path.includes(anchorRef.current) ||
        path.some((node) => node.hasAttribute?.("data-kiss-touch-ui"))
      ) {
        return;
      }
      closeMenu();
    };
    const handleTouchStart = () => {
      touchMoved = false;
    };
    const handleTouchMove = () => {
      touchMoved = true;
    };
    const handleTouchEnd = (event) => {
      if (!touchMoved) handleClickAway(event);
      touchMoved = false;
    };

    ownerDocument.addEventListener("click", handleClickAway, true);
    ownerDocument.addEventListener("touchstart", handleTouchStart, true);
    ownerDocument.addEventListener("touchmove", handleTouchMove, true);
    ownerDocument.addEventListener("touchend", handleTouchEnd, true);
    return () => {
      ownerDocument.removeEventListener("click", handleClickAway, true);
      ownerDocument.removeEventListener("touchstart", handleTouchStart, true);
      ownerDocument.removeEventListener("touchmove", handleTouchMove, true);
      ownerDocument.removeEventListener("touchend", handleTouchEnd, true);
    };
  }, [closeMenu, open, opensMenu]);

  // Popper does not observe the anchor's edge-reveal transform animation.
  const updateMenuPosition = useCallback(() => {
    popperRef.current?.update();
  }, []);

  useEffect(() => {
    if (open) {
      popperRef.current?.update();
    }
  }, [open, windowSize]);

  // Handle the start of a drag without changing ordinary click behavior.
  const handleStart = useCallback(() => {
    setMoved(false);
  }, []);

  // Close the menu before its transformed anchor moves away from it.
  const handleMove = useCallback(() => {
    setMoved(true);
    closeMenu(true);
  }, [closeMenu]);

  // Run an action and close the menu.
  const runAction = useCallback(
    (action) => {
      processActions({ action });
      closeMenu(true);
    },
    [closeMenu, processActions]
  );

  // Open the extension options page in a new browser tab.
  const openSettings = useCallback(() => {
    // Navigation can synchronously deactivate this page. Do not restore focus
    // afterward, which would reveal the FAB again when returning to this tab.
    closeMenu();
    if (isExt) {
      sendBgMsg(MSG_OPEN_OPTIONS);
    } else {
      window.open(
        process.env.REACT_APP_OPTIONSPAGE,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }, [closeMenu]);

  // Ignore clicks after dragging to prevent accidental activation.
  const handleClick = useCallback(() => {
    if (moved) {
      return;
    }
    // fabClickAction === 1 keeps the legacy direct translation action.
    if (!opensMenu) {
      runAction(MSG_TRANS_TOGGLE);
      return;
    }
    setOpen((current) => !current);
  }, [moved, opensMenu, runAction]);

  // Close the menu and return focus to the FAB before menu items unmount.
  const handleMenuKeyDown = useCallback(
    (event) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    },
    [closeMenu]
  );

  // Position the FAB at the viewport edge and vertical center on first load.
  const fabProps = useMemo(
    () => ({
      windowSize,
      width: fabSize,
      height: fabSize,
      left: fabX ?? -fabSize,
      top: fabY ?? windowSize.h / 2,
      edge: fabEdge,
    }),
    [windowSize, fabSize, fabX, fabY, fabEdge]
  );

  const items = [
    {
      label: i18n("popup_translate_page"),
      icon: TranslateRoundedIcon,
      action: () => runAction(MSG_TRANS_TOGGLE),
      pressed: pageRule?.transOpen === true || pageRule?.transOpen === "true",
    },
    {
      label: i18n("text_style_alt"),
      icon: PaletteRoundedIcon,
      action: () => runAction(MSG_TRANS_TOGGLE_STYLE),
      pressed: Boolean(
        pageRule?.textStyle && pageRule.textStyle !== OPT_STYLE_NONE
      ),
    },
    {
      label: i18n("selection_translate"),
      icon: SelectAllRoundedIcon,
      action: () => runAction(MSG_OPEN_TRANBOX),
      disabled: !selectionEnabled,
    },
    {
      label: i18n("open_menu"),
      icon: TuneRoundedIcon,
      action: () => runAction(MSG_POPUP_TOGGLE),
    },
    {
      label: i18n("open_setting"),
      icon: SettingsRoundedIcon,
      action: openSettings,
    },
    {
      label: i18n("touch_paragraph"),
      icon: TranslateRoundedIcon,
      action: () => setTouchOpen((value) => !value),
      hidden: !supportsTouch(),
    },
  ].filter((item) => !item.hidden);

  return (
    <>
      <Draggable
        key="fab"
        snapEdge // Keep edge snapping independent of the half-hide preference.
        halfHide={halfHide}
        idleOpacity={opacity}
        fitContent // The fixed menu must not be constrained by the FAB wrapper.
        expanded={opensMenu && open} // Keep the anchor fully revealed while the menu is open.
        {...fabProps}
        show={showFab}
        onStart={handleStart}
        onMove={handleMove}
        onDeactivate={closeMenu}
        onPositionTransitionEnd={updateMenuPosition}
        handler={
          <FloatingButton
            id="kt-content-fab-button"
            ref={anchorRef}
            size={fabSize}
            opensMenu={opensMenu}
            open={open}
            aria-expanded={opensMenu ? open : undefined}
            aria-haspopup={opensMenu ? "menu" : undefined}
            aria-controls={
              opensMenu && open ? "kt-content-fab-menu" : undefined
            }
            aria-label={i18n("translate")}
            onClick={handleClick}
          />
        }
      >
        <Popper
          popperRef={popperRef}
          open={opensMenu && open && Boolean(anchorRef.current)}
          anchorEl={anchorRef.current}
          placement="top-end"
          // Render inside the content page's shadow root to retain M3Theme styles;
          // a portal to document.body would escape that root.
          disablePortal
          popperOptions={{ strategy: "fixed" }}
          modifiers={FAB_POPPER_MODIFIERS}
        >
          <Paper ref={menuRef} className="kt-content-fab-menu" elevation={0}>
            <MenuList
              id="kt-content-fab-menu"
              className="kt-content-fab-menu__list"
              aria-labelledby="kt-content-fab-button"
              autoFocusItem
              onKeyDownCapture={handleMenuNavigation}
              onKeyDown={handleMenuKeyDown}
            >
              {items.map(
                ({ label, icon: Icon, action, disabled, pressed }, index) => (
                  <MenuItem
                    className={`kt-content-fab-menu__item ${
                      index === 0
                        ? "kt-content-fab-menu__item--hero"
                        : index === 5
                          ? "kt-content-fab-menu__item--touch"
                          : ""
                    }`}
                    disabled={disabled}
                    aria-pressed={pressed}
                    onClick={disabled ? undefined : action}
                    key={label}
                  >
                    <ListItemIcon>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText>{label}</ListItemText>
                  </MenuItem>
                )
              )}
            </MenuList>
            <FabQuickOptions
              getFabPageState={getFabPageState}
              processActions={processActions}
              onPageRule={setPageRule}
              onHideOnSite={handleHideOnSite}
              currentFabSize={fabSize}
              onChangeFabSize={handleSizeChange}
            />
            {touchOpen && (
              <TouchTranslateControl processActions={processActions} />
            )}
          </Paper>
        </Popper>
      </Draggable>
      {undoToast.open && (
        <Snackbar
          open={undoToast.open}
          autoHideDuration={undoToast.error && !undoToast.domain ? 4500 : null}
          onClose={() => {
            if (undoToast.error && !undoToast.domain) {
              setUndoToast({ open: false, domain: "" });
            }
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          className="kt-fab-undo-snackbar"
        >
          <Alert
            severity={undoToast.error ? "error" : "info"}
            variant="filled"
            action={
              undoToast.domain ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleUndoHide}
                  className="kt-fab-undo-btn"
                >
                  {i18n("fab_undo")}
                </Button>
              ) : undefined
            }
          >
            {i18n(
              undoToast.error
                ? "error_got_some_wrong"
                : "fab_hidden_on_site_toast"
            )}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}

export default function ContentFab(props) {
  return (
    <SettingProvider context="fab">
      <ThemeProvider>
        <style>{ACTION_STYLES}</style>
        <ContentFabContent {...props} />
      </ThemeProvider>
    </SettingProvider>
  );
}
