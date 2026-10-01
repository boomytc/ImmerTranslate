import { FLOATING_BUTTON_STYLES } from "../../components/FloatingButton.styles";

/**
 * Material 3 styles for the content FAB and its action menu.
 * These rules depend on the CSS variables injected by M3Theme.
 */
export const ACTION_STYLES = String.raw`${FLOATING_BUTTON_STYLES}
.kt-content-fab-menu { min-width: 220px; max-width: min(320px, calc(100vw - 24px)); max-height: min(440px, calc(100vh - 24px)); box-sizing: border-box; touch-action: pan-y; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: var(--kt-space-xs, 8px); border: 1px solid var(--kt-liquid-edge, var(--kt-border-strong, var(--kt-linev))); border-radius: var(--kt-radius-xl, 22px); background: var(--kt-liquid, var(--kt-sf0)); color: var(--kt-on); box-shadow: var(--kt-liquid-shadow, var(--kt-shadow-menu)); -webkit-backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); }
.kt-content-fab-menu .MuiMenu-list { display: flex; flex-direction: column; gap: var(--kt-space-2xs, 4px); padding: 0; }
.kt-content-fab-menu__item { min-height: 44px; gap: var(--kt-space-xs, 8px); padding: 0 var(--kt-space-sm, 12px); border-radius: var(--kt-radius-md, 12px); color: var(--kt-on); font-size: 13px; font-weight: 650; letter-spacing: -0.011em; white-space: nowrap; transition: transform var(--kt-dur, .15s) var(--kt-ease, ease-out), box-shadow var(--kt-dur, .15s) var(--kt-ease, ease-out), border-color var(--kt-dur, .15s) var(--kt-ease, ease-out), background-color var(--kt-dur, .15s) var(--kt-ease, ease-out); }
@media (hover: hover) {
  .kt-content-fab-menu__item:hover { background: var(--kt-sf3); color: var(--kt-on); }
  .kt-content-fab-menu__item[aria-pressed="true"]:hover { background: var(--kt-pric); color: var(--kt-onpric); }
}
.kt-content-fab-menu__item[aria-pressed="true"] { background: var(--kt-pric); color: var(--kt-onpric); }
.kt-content-fab-menu__item[aria-pressed="true"] .MuiListItemIcon-root { color: var(--kt-onpric); }
.kt-content-fab-menu__item:active { transform: scale(.97); }
.kt-content-fab-menu__item .MuiListItemIcon-root { min-width: 24px; color: var(--kt-pri); }
.kt-content-fab-menu__item svg { width: 19px; height: 19px; }
.kt-content-fab-menu__options { display: flex; flex-direction: column; gap: var(--kt-space-xs, 8px); margin-top: var(--kt-space-xs, 8px); padding: var(--kt-space-xs, 8px) var(--kt-space-2xs, 4px) 0; border-top: 1px solid var(--kt-border, var(--kt-linev)); }
.kt-content-fab-menu__modes { display: flex; gap: var(--kt-space-2xs, 4px); }
.kt-content-fab-menu__sites { display: flex; flex-wrap: wrap; gap: var(--kt-space-2xs, 4px); }
.kt-content-fab-menu__services { display: flex; flex-direction: column; gap: var(--kt-space-2xs, 4px); max-height: 144px; overflow-x: hidden; overflow-y: auto; }
.kt-content-fab-menu__services .kt-content-fab-menu__mode { flex: 0 0 auto; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.kt-content-fab-menu__mode { flex: 1 1 0; min-height: 36px; padding: 0 var(--kt-space-xs, 8px); border: 1px solid var(--kt-border-strong, var(--kt-linev)); border-radius: var(--kt-radius-md, 12px); background: var(--kt-sf0); color: var(--kt-on); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
.kt-content-fab-menu__sites .kt-content-fab-menu__mode { flex: 1 1 30%; min-width: 4.75rem; padding: 6px 8px; line-height: 1.25; text-align: center; white-space: normal; }
.kt-content-fab-menu__mode[aria-pressed="true"] { border-color: transparent; background: var(--kt-pric); color: var(--kt-onpric); }
.kt-content-fab-menu__field { display: flex; flex-direction: column; gap: 4px; color: var(--kt-onv); font-size: 11px; font-weight: 650; }
.kt-content-fab-menu__mode--hide-fab { width: 100%; color: var(--kt-onv); border-style: dashed; }
@media (hover: hover) {
  .kt-content-fab-menu__mode--hide-fab:hover { background: var(--kt-sf2); color: var(--kt-on); }
}
.kt-content-fab-menu__empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 12px); background: var(--kt-sf2); color: var(--kt-on); }
.kt-content-fab-menu__empty p { margin: 0; font-size: 12px; font-weight: 500; line-height: 1.45; white-space: normal; }
.kt-content-fab-menu__empty button { min-height: 32px; padding: 0 10px; border: 0; border-radius: var(--kt-radius-md, 12px); background: var(--kt-pri); color: var(--kt-onpri); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.kt-content-fab-menu__model, .kt-content-fab-menu__lang { width: 100%; min-height: 36px; padding: 0 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 12px); background: var(--kt-sf0); color: var(--kt-on); font: inherit; font-size: 12px; font-weight: 650; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.kt-fab-undo-snackbar { position: fixed !important; bottom: 24px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; pointer-events: auto; max-width: min(420px, calc(100vw - 32px)) !important; box-sizing: border-box !important; }
.kt-fab-undo-snackbar .MuiAlert-root { border-radius: var(--kt-radius-chip, 14px); box-shadow: var(--kt-shadow-2); font-size: 13px; font-weight: 600; max-width: 100%; }
.kt-fab-undo-btn { min-height: 36px !important; min-width: 48px !important; padding: 4px 10px !important; font-weight: 700 !important; text-decoration: underline !important; cursor: pointer; }
`;
