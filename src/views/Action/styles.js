import { FLOATING_BUTTON_STYLES } from "../../components/FloatingButton.styles";

/**
 * Styles for the content FAB and its floating action menu inside Shadow DOM.
 * Rules consume Editorial Ink & Cerulean tokens injected by M3Theme (`isolateRem`).
 */
export const ACTION_STYLES = String.raw`${FLOATING_BUTTON_STYLES}
.kt-fab-draggable {
  transition: opacity var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (prefers-reduced-motion: no-preference) {
  .kt-fab-draggable--positioned {
    transition: opacity var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform 180ms var(--kt-ease, ease-out);
  }
}

.kt-content-fab-menu {
  min-width: 272px;
  max-width: min(336px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 24px));
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-panel, 16px);
  background: var(--kt-liquid, var(--kt-sf0));
  color: var(--kt-on);
  box-shadow: var(--kt-shadow-menu);
  -webkit-backdrop-filter: var(--kt-liquid-blur);
  backdrop-filter: var(--kt-liquid-blur);
  zoom: 1;
  font-size: var(--kt-text-body, 14px);
  line-height: 1.45;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.kt-content-fab-menu__list,
.kt-content-fab-menu .MuiList-root,
.kt-content-fab-menu .MuiMenu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
}

.kt-content-fab-menu__item.MuiMenuItem-root {
  box-sizing: border-box;
  min-height: 36px;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-size: var(--kt-text-body, 14px);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-content-fab-menu__item--hero.MuiMenuItem-root,
.kt-content-fab-menu__item.MuiMenuItem-root:first-child {
  min-height: 40px;
  font-weight: 600;
}
.kt-content-fab-menu__item .MuiListItemText-root {
  margin: 0;
  min-width: 0;
  overflow: hidden;
}
.kt-content-fab-menu__item .MuiListItemText-root .MuiTypography-root {
  font-size: var(--kt-text-body, 14px);
  font-weight: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}
@media (hover: hover) {
  .kt-content-fab-menu__item.MuiMenuItem-root:hover {
    background: var(--kt-sf1);
    border-color: var(--kt-line);
    color: var(--kt-on);
  }
  .kt-content-fab-menu__item.MuiMenuItem-root[aria-checked="true"]:hover {
    background: var(--kt-pric);
    border-color: var(--kt-pri);
    color: var(--kt-onpric);
  }
}
.kt-content-fab-menu__item.MuiMenuItem-root[aria-checked="true"] {
  background: var(--kt-pric);
  color: var(--kt-onpric);
  border-color: var(--kt-pri);
}
.kt-content-fab-menu__item[aria-checked="true"] .MuiListItemIcon-root {
  color: var(--kt-onpric);
}
@media (prefers-reduced-motion: no-preference) {
  .kt-content-fab-menu__item.MuiMenuItem-root {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .kt-content-fab-menu__item.MuiMenuItem-root:active {
    transform: scale(0.98);
  }
}
.kt-content-fab-menu__item .MuiListItemIcon-root {
  min-width: 20px;
  color: var(--kt-pri);
}
.kt-content-fab-menu__item svg {
  width: 18px;
  height: 18px;
}

.kt-content-fab-menu__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--kt-linev);
}

.kt-content-fab-menu__row {
  display: grid;
  grid-template-columns: minmax(76px, auto) minmax(136px, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 32px;
  box-sizing: border-box;
}
.kt-content-fab-menu__row--stacked {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.kt-content-fab-menu__row-label {
  min-width: 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}
.kt-content-fab-menu__row-empty {
  font-size: var(--kt-text-sm, 13px);
  color: var(--kt-onv);
  line-height: 1.4;
}

.kt-content-fab-menu__select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  color: var(--kt-on);
}
.kt-content-fab-menu__select,
.kt-content-fab-menu__model,
.kt-content-fab-menu__lang {
  min-width: 0;
  width: 100%;
  height: 32px;
  line-height: 30px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--kt-line);
  border-radius: var(--kt-radius-control, 10px);
  background-color: var(--kt-sf0);
  color: var(--kt-on);
  font: inherit;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  box-sizing: border-box;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-content-fab-menu__chevron {
  position: absolute;
  right: 8px;
  width: 18px !important;
  height: 18px !important;
  color: var(--kt-onv);
  pointer-events: none;
}
@media (hover: hover) {
  .kt-content-fab-menu__select:hover,
  .kt-content-fab-menu__model:hover,
  .kt-content-fab-menu__lang:hover {
    background-color: var(--kt-sf1);
    border-color: var(--kt-on);
  }
}
.kt-content-fab-menu__select:focus-visible,
.kt-content-fab-menu__model:focus-visible,
.kt-content-fab-menu__lang:focus-visible {
  outline: none;
  border-color: var(--kt-pri);
  box-shadow: 0 0 0 1px var(--kt-pri);
}
@media (forced-colors: active) {
  .kt-content-fab-menu__select:focus-visible,
  .kt-content-fab-menu__model:focus-visible,
  .kt-content-fab-menu__lang:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 1px;
  }
}
.kt-content-fab-menu__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kt-content-fab-menu__service-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Connected 10px 2-segment toggle matching Options SettingsSegmented. */
.kt-fab-segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  padding: 3px;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf2);
}
.kt-fab-segmented__item {
  min-width: 0;
  min-height: 30px;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--kt-onv);
  font: inherit;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-fab-segmented__item:hover {
    background: var(--kt-sf1);
    color: var(--kt-on);
  }
}
.kt-fab-segmented__item--active {
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-weight: 600;
  box-shadow: var(--kt-shadow-card);
}
@media (hover: hover) {
  .kt-fab-segmented__item--active:hover {
    background: var(--kt-sf0);
  }
}
@media (forced-colors: active) {
  .kt-fab-segmented__item--active {
    border: 1px solid Highlight;
  }
}

.kt-content-fab-menu__footer {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--kt-linev);
}
.kt-content-fab-menu__hide-fab {
  width: 100%;
  min-height: 32px;
  padding: 5px 10px;
  border: 0;
  border-radius: var(--kt-radius-control, 10px);
  background: transparent;
  color: var(--kt-onv);
  font: inherit;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  line-height: 1.35;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-content-fab-menu__hide-fab:hover {
    background: var(--kt-sf2);
    color: var(--kt-on);
  }
}

.kt-content-fab-menu__empty {
  padding: 8px 10px;
}

.kt-fab-undo-snackbar {
  position: fixed !important;
  bottom: 24px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  z-index: 2147483647 !important;
  pointer-events: auto;
  max-width: min(420px, calc(100vw - 32px)) !important;
  box-sizing: border-box !important;
}
.kt-fab-undo-snackbar .MuiAlert-root {
  border-radius: var(--kt-radius-surface, 12px);
  box-shadow: var(--kt-shadow-menu);
  font-size: var(--kt-text-body, 14px);
  font-weight: 500;
  max-width: 100%;
}
.kt-fab-undo-btn {
  min-height: 32px !important;
  min-width: 48px !important;
  padding: 4px 10px !important;
  font-weight: 600 !important;
  text-decoration: underline !important;
  cursor: pointer;
}
`;
