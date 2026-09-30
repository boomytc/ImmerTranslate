import { FLOATING_BUTTON_STYLES } from "../../components/FloatingButton.styles";

/**
 * Material 3 styles for the content FAB and its action menu.
 * These rules depend on the CSS variables injected by M3Theme.
 */
export const ACTION_STYLES = String.raw`${FLOATING_BUTTON_STYLES}
.kt-content-fab-menu { min-width: 210px; max-height: min(360px, calc(100vh - 24px)); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 6px; border: 1px solid var(--kt-liquid-edge, var(--kt-border, var(--kt-linev))); border-radius: var(--kt-radius-xl, 22px); background: var(--kt-liquid, var(--kt-sf0)); box-shadow: var(--kt-shadow-menu, var(--kt-shadow-2)); -webkit-backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); }
.kt-content-fab-menu .MuiMenu-list { display: flex; flex-direction: column; gap: 4px; padding: 0; }
.kt-content-fab-menu__item { min-height: 44px; gap: 10px; padding: 0 14px; border-radius: var(--kt-radius-md, 12px); color: var(--kt-on); font-size: 12.5px; font-weight: 650; white-space: nowrap; transition: transform var(--kt-dur, .15s) var(--kt-ease, ease-out), box-shadow var(--kt-dur, .15s) var(--kt-ease, ease-out), border-color var(--kt-dur, .15s) var(--kt-ease, ease-out); }
@media (hover: hover) {
  .kt-content-fab-menu__item:hover { background: var(--kt-sf1); }
}
.kt-content-fab-menu__item:active { transform: scale(.97); }
.kt-content-fab-menu__item .MuiListItemIcon-root { min-width: 24px; color: var(--kt-pri); }
.kt-content-fab-menu__item svg { width: 19px; height: 19px; }
.kt-content-fab-menu__options { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--kt-linev); }
.kt-content-fab-menu__modes { display: flex; gap: 4px; }
.kt-content-fab-menu__sites { display: flex; flex-wrap: wrap; gap: 4px; }
.kt-content-fab-menu__services { display: flex; flex-direction: column; gap: 4px; max-height: 144px; overflow-x: hidden; overflow-y: auto; }
.kt-content-fab-menu__services .kt-content-fab-menu__mode { flex: 0 0 auto; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.kt-content-fab-menu__mode { flex: 1 1 0; min-height: 36px; padding: 0 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 12px); background: transparent; color: var(--kt-on); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
.kt-content-fab-menu__sites .kt-content-fab-menu__mode { flex: 1 1 30%; min-width: 4.75rem; padding: 6px 8px; line-height: 1.25; text-align: center; white-space: normal; }
.kt-content-fab-menu__mode[aria-pressed="true"] { border-color: transparent; background: var(--kt-pric); color: var(--kt-onpric); }
.kt-content-fab-menu__field { display: flex; flex-direction: column; gap: 4px; color: var(--kt-onv); font-size: 11px; font-weight: 650; }
.kt-content-fab-menu__model { width: 100%; min-height: 36px; padding: 0 8px; border: 1px solid var(--kt-linev); border-radius: var(--kt-radius-md, 12px); background: var(--kt-sf0); color: var(--kt-on); font: inherit; font-size: 12px; font-weight: 650; }
`;
