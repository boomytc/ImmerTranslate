// Shared appearance for the content FAB and its live settings preview.
export const FLOATING_BUTTON_STYLES = String.raw`
.kt-content-fab.MuiFab-root {
  width: var(--kt-fab-size, 56px);
  height: var(--kt-fab-size, 56px);
  min-width: var(--kt-fab-size, 56px);
  min-height: var(--kt-fab-size, 56px);
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--kt-fab-radius, 28px);
  background-color: var(--kt-liquid-tint, var(--kt-glass-tint, var(--kt-pric)));
  box-shadow: var(--kt-liquid-shadow, var(--kt-shadow-menu)), inset 0 0 0 1px var(--kt-liquid-edge, var(--kt-glass-edge, transparent));
  -webkit-backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06));
  backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06));
  color: var(--kt-onpric);
  cursor: pointer;
  transition: transform var(--kt-dur, .15s) var(--kt-ease, ease-out), box-shadow var(--kt-dur, .15s) var(--kt-ease, ease-out), border-color var(--kt-dur, .15s) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-content-fab.MuiFab-root:hover {
    background-color: var(--kt-pric);
    background-color: color-mix(in srgb, var(--kt-onpric) 8%, var(--kt-pric));
  }
}
.kt-content-fab.MuiFab-root.Mui-focusVisible,
.kt-content-fab.MuiFab-root[aria-expanded="true"],
.kt-content-fab.MuiFab-root:active {
  background-color: var(--kt-pric);
  background-color: color-mix(in srgb, var(--kt-onpric) 10%, var(--kt-pric));
}
.kt-content-fab.MuiFab-root:active { transform: scale(.96); }
.kt-content-fab.MuiFab-root.Mui-focusVisible { outline: none; box-shadow: var(--kt-liquid-shadow, var(--kt-shadow-menu)), inset 0 0 0 2px var(--kt-pri); }
.kt-content-fab .MuiSpeedDialIcon-root { width: var(--kt-fab-icon-size, 24px); height: var(--kt-fab-icon-size, 24px); display: grid; place-items: center; }
.kt-content-fab .MuiSvgIcon-root { width: var(--kt-fab-icon-size, 24px); height: var(--kt-fab-icon-size, 24px); font-size: var(--kt-fab-icon-size, 24px); }
`;
