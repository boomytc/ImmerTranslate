/**
 * @file styles.js
 * @description Styles for the selection translation panel and floating trigger.
 *
 * Rules consume tokens from hooks/M3Theme (`isolateRem`) and keyframes from
 * src/styles/m3.js.
 */
export const SELECTION_STYLES = String.raw`
.KT-draggable {
  overflow: visible;
  border-radius: var(--kt-radius-panel, 16px);
}
@media (prefers-reduced-motion: no-preference) {
  .KT-draggable {
    animation: kt-m3-rise var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.KT-draggable-header { overflow: visible; }

/* Unified floating trigger matching FloatingButton surface recipe. */
.KT-tranbtn {
  box-sizing: border-box;
  width: var(--kt-tranbtn-size, var(--kt-fab-size, 56px));
  height: var(--kt-tranbtn-size, var(--kt-fab-size, 56px));
  min-width: var(--kt-tranbtn-size, var(--kt-fab-size, 56px));
  min-height: var(--kt-tranbtn-size, var(--kt-fab-size, 56px));
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  appearance: none;
  background-color: var(--kt-liquid-tint, var(--kt-pric));
  box-shadow: var(--kt-shadow-menu), inset 0 0 0 1px var(--kt-linev);
  -webkit-backdrop-filter: var(--kt-liquid-blur);
  backdrop-filter: var(--kt-liquid-blur);
  color: var(--kt-onpric);
  cursor: pointer;
  font: inherit;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .KT-tranbtn:hover {
    background-color: var(--kt-pric);
    background-color: color-mix(in oklab, var(--kt-onpric) 8%, var(--kt-pric));
  }
}
.KT-tranbtn:active {
  background-color: var(--kt-pric);
  background-color: color-mix(in oklab, var(--kt-onpric) 12%, var(--kt-pric));
}
@media (prefers-reduced-motion: no-preference) {
  .KT-tranbtn {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .KT-tranbtn:active {
    transform: scale(0.95);
  }
}
.KT-tranbtn:focus {
  outline: 2px solid var(--kt-pri);
  outline-offset: 2px;
}
@supports selector(:focus-visible) {
  .KT-tranbtn:focus { outline: none; }
  .KT-tranbtn:focus-visible {
    outline: 2px solid var(--kt-pri);
    outline-offset: 2px;
  }
}
@media (forced-colors: active) {
  .KT-tranbtn:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
.KT-tranbtn svg {
  width: var(--kt-tranbtn-icon-size, var(--kt-fab-icon-size, 24px));
  height: var(--kt-tranbtn-icon-size, var(--kt-fab-icon-size, 24px));
  fill: currentColor;
}
`;
