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
  background-color: var(--kt-liquid-tint, var(--kt-pric));
  box-shadow: var(--kt-shadow-menu), inset 0 0 0 1px var(--kt-linev);
  -webkit-backdrop-filter: var(--kt-liquid-blur);
  backdrop-filter: var(--kt-liquid-blur);
  color: var(--kt-onpric);
  cursor: pointer;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-content-fab.MuiFab-root:hover {
    background-color: var(--kt-pric);
    background-color: color-mix(in oklab, var(--kt-onpric) 8%, var(--kt-pric));
  }
}
.kt-content-fab.MuiFab-root.Mui-focusVisible,
.kt-content-fab.MuiFab-root[aria-expanded="true"],
.kt-content-fab.MuiFab-root:active {
  background-color: var(--kt-pric);
  background-color: color-mix(in oklab, var(--kt-onpric) 12%, var(--kt-pric));
}
@media (prefers-reduced-motion: no-preference) {
  .kt-content-fab.MuiFab-root {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .kt-content-fab.MuiFab-root:active {
    transform: scale(0.95);
  }
}
.kt-content-fab.MuiFab-root.Mui-focusVisible {
  outline: 2px solid var(--kt-pri);
  outline-offset: 2px;
}
@media (forced-colors: active) {
  .kt-content-fab.MuiFab-root.Mui-focusVisible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
.kt-content-fab .MuiSpeedDialIcon-root {
  width: var(--kt-fab-icon-size, 24px);
  height: var(--kt-fab-icon-size, 24px);
  display: grid;
  place-items: center;
}
.kt-content-fab .MuiSvgIcon-root {
  width: var(--kt-fab-icon-size, 24px);
  height: var(--kt-fab-icon-size, 24px);
  font-size: var(--kt-fab-icon-size, 24px);
}
`;
