import { FLOATING_BUTTON_STYLES } from "../../components/FloatingButton.styles";

/**
 * Material 3 styles for the content FAB and its action menu.
 * These rules depend on the CSS variables injected by M3Theme.
 */
export const ACTION_STYLES = String.raw`${FLOATING_BUTTON_STYLES}
.kt-content-fab-menu { min-width: 240px; max-width: min(320px, calc(100vw - 24px)); max-height: min(480px, calc(100vh - 24px)); box-sizing: border-box; touch-action: pan-y; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: var(--kt-space-xs, 8px); border: 1px solid var(--kt-liquid-edge, var(--kt-border-strong, var(--kt-linev))); border-radius: var(--kt-radius-xl, 22px); background: var(--kt-liquid, var(--kt-sf0)); color: var(--kt-on); box-shadow: var(--kt-liquid-shadow, var(--kt-shadow-menu)); -webkit-backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); zoom: 1; font-size: 13px !important; line-height: 1.4 !important; -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
.kt-content-fab-menu__list, .kt-content-fab-menu .MuiList-root, .kt-content-fab-menu .MuiMenu-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--kt-space-2xs, 4px); padding: 0; }
.kt-content-fab-menu__item { box-sizing: border-box; min-height: 36px; gap: var(--kt-space-xs, 6px); padding: 0 var(--kt-space-xs, 8px); border-radius: var(--kt-radius-md, 12px); color: var(--kt-on); font-size: 12px; font-weight: 650; letter-spacing: -0.011em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--kt-sf1); border: 1px solid var(--kt-linev); transition: transform var(--kt-dur, .15s) var(--kt-ease, ease-out), box-shadow var(--kt-dur, .15s) var(--kt-ease, ease-out), border-color var(--kt-dur, .15s) var(--kt-ease, ease-out), background-color var(--kt-dur, .15s) var(--kt-ease, ease-out); }
.kt-content-fab-menu__item--hero, .kt-content-fab-menu__item:first-child { grid-column: 1 / -1; min-height: 40px; font-size: 13px; font-weight: 700; padding: 0 var(--kt-space-sm, 12px); }
.kt-content-fab-menu__item--touch { grid-column: 1 / -1; }
.kt-content-fab-menu__item .MuiListItemText-root { margin: 0; min-width: 0; overflow: hidden; }
.kt-content-fab-menu__item .MuiListItemText-root .MuiTypography-root { font-size: 12px !important; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.kt-content-fab-menu__item--hero .MuiListItemText-root .MuiTypography-root, .kt-content-fab-menu__item:first-child .MuiListItemText-root .MuiTypography-root { font-size: 13px !important; font-weight: 700; }
@media (hover: hover) {
  .kt-content-fab-menu__item:hover { background: var(--kt-sf3); color: var(--kt-on); }
  .kt-content-fab-menu__item[aria-pressed="true"]:hover { background: var(--kt-pric); color: var(--kt-onpric); }
}
.kt-content-fab-menu__item[aria-pressed="true"] { background: var(--kt-pric); color: var(--kt-onpric); border-color: transparent; }
.kt-content-fab-menu__item[aria-pressed="true"] .MuiListItemIcon-root { color: var(--kt-onpric); }
.kt-content-fab-menu__item:active { transform: scale(.97); }
.kt-content-fab-menu__item .MuiListItemIcon-root { min-width: 20px; color: var(--kt-pri); }
.kt-content-fab-menu__item svg { width: 18px; height: 18px; }
.kt-content-fab-menu__options { display: flex; flex-direction: column; gap: var(--kt-space-2xs, 4px); margin-top: var(--kt-space-xs, 6px); padding: var(--kt-space-xs, 6px) var(--kt-space-2xs, 2px) 0; border-top: 1px solid var(--kt-border, var(--kt-linev)); }
.kt-content-fab-menu__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; box-sizing: border-box; }
.kt-content-fab-menu__row-label { flex: 0 0 68px; color: var(--kt-onv); font-size: 11px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.kt-content-fab-menu__row-empty { font-size: 11px; color: var(--kt-onv); font-style: italic; }
.kt-content-fab-menu__select, .kt-content-fab-menu__model, .kt-content-fab-menu__lang { flex: 1 1 auto; min-width: 0; width: 100%; height: 28px; line-height: 28px; padding: 0 20px 0 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 10px); background-color: var(--kt-sf0); color: var(--kt-on); font: inherit; font-size: 11px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; box-sizing: border-box; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(128,128,128,0.85)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 6px center; background-size: 10px; transition: border-color var(--kt-dur, .15s), background-color var(--kt-dur, .15s); }
.kt-content-fab-menu__select:hover, .kt-content-fab-menu__model:hover, .kt-content-fab-menu__lang:hover { background-color: var(--kt-sf2); border-color: var(--kt-pri); }
.kt-content-fab-menu__select:focus, .kt-content-fab-menu__model:focus, .kt-content-fab-menu__lang:focus { border-color: var(--kt-pri); box-shadow: 0 0 0 1px var(--kt-pri); }
.kt-content-fab-menu__select:disabled { opacity: .6; cursor: not-allowed; }
.kt-content-fab-menu__service-field { display: flex; flex-direction: column; gap: 3px; }
.kt-content-fab-menu__modes { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--kt-space-2xs, 4px); }
.kt-content-fab-menu__sites { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-space-2xs, 4px); }
.kt-content-fab-menu__sizes { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-space-2xs, 4px); }
.kt-content-fab-menu__services { display: flex; flex-direction: column; gap: var(--kt-space-2xs, 4px); max-height: 120px; overflow-x: hidden; overflow-y: auto; }
.kt-content-fab-menu__services .kt-content-fab-menu__mode { flex: 0 0 auto; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.kt-content-fab-menu__mode { min-height: 28px; padding: 0 var(--kt-space-xs, 6px); border: 1px solid var(--kt-border-strong, var(--kt-linev)); border-radius: var(--kt-radius-md, 10px); background: var(--kt-sf0); color: var(--kt-on); font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; box-sizing: border-box; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt-content-fab-menu__sites .kt-content-fab-menu__mode { padding: 4px 2px; line-height: 1.25; }
.kt-content-fab-menu__sizes .kt-content-fab-menu__mode { padding: 4px 2px; }
.kt-content-fab-menu__mode[aria-pressed="true"] { border-color: transparent; background: var(--kt-pric); color: var(--kt-onpric); }
.kt-content-fab-menu__field { display: flex; flex-direction: column; gap: 3px; color: var(--kt-onv); font-size: 11px; font-weight: 650; }
.kt-content-fab-menu__mode--hide-fab { width: 100%; color: var(--kt-onv); border-style: dashed; }
@media (hover: hover) {
  .kt-content-fab-menu__mode--hide-fab:hover { background: var(--kt-sf2); color: var(--kt-on); }
}
.kt-content-fab-menu__empty { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 6px 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 10px); background: var(--kt-sf2); color: var(--kt-on); }
.kt-content-fab-menu__empty p { margin: 0; font-size: 11px; font-weight: 500; line-height: 1.4; white-space: normal; }
.kt-content-fab-menu__empty button { min-height: 26px; padding: 0 8px; border: 0; border-radius: var(--kt-radius-md, 8px); background: var(--kt-pri); color: var(--kt-onpri); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.kt-fab-undo-snackbar { position: fixed !important; bottom: 24px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; pointer-events: auto; max-width: min(420px, calc(100vw - 32px)) !important; box-sizing: border-box !important; }
.kt-fab-undo-snackbar .MuiAlert-root { border-radius: var(--kt-radius-chip, 14px); box-shadow: var(--kt-shadow-2); font-size: 13px; font-weight: 600; max-width: 100%; }
.kt-fab-undo-btn { min-height: 36px !important; min-width: 48px !important; padding: 4px 10px !important; font-weight: 700 !important; text-decoration: underline !important; cursor: pointer; }
`;
