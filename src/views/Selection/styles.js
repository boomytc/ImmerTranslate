/**
 * @file styles.js
 * @description Material 3 styles for the selection translation panel.
 *
 * These rules require CSS variables from hooks/M3Theme, including --kt-sf0
 * and --kt-linev, plus the kt-m3-rise and kt-m3-pop keyframes from
 * src/styles/m3.js. Use them only inside M3Theme.
 *
 * DraggableResizable.js emits the KT-draggable* classes. Their overrides need
 * !important to take precedence over the nodes' MUI sx styles.
 */
export const SELECTION_STYLES = String.raw`
.KT-draggable { overflow: visible !important; border-radius: var(--kt-radius-card, 20px) !important; animation: kt-m3-rise var(--kt-dur, .2s) var(--kt-ease, ease-out); }
.KT-draggable-header { overflow: visible; }

.KT-tranbtn { box-sizing: border-box; width: 44px; height: 44px; min-width: 44px; min-height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; appearance: none; background-color: var(--kt-pric); box-shadow: 0 0 0 1px var(--kt-pri), 0 8px 24px rgb(23 24 28 / 0.28), var(--kt-shadow-menu, var(--kt-shadow-2)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--kt-pri) 46%, transparent), 0 8px 24px color-mix(in srgb, var(--kt-pri) 28%, transparent), var(--kt-liquid-shadow, var(--kt-shadow-menu)); -webkit-backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); backdrop-filter: var(--kt-liquid-blur, blur(22px) saturate(1.75) brightness(1.06)); color: var(--kt-onpric); cursor: pointer; font: inherit; transition: background-color var(--kt-dur, .2s) var(--kt-ease, ease-out), box-shadow var(--kt-dur, .2s) var(--kt-ease, ease-out), transform var(--kt-dur, .2s) var(--kt-ease, ease-out); }
@media (hover: hover) {
  .KT-tranbtn:hover { background-color: var(--kt-pric); background-color: color-mix(in srgb, var(--kt-onpric) 8%, var(--kt-pric)); }
}
.KT-tranbtn:active { background-color: var(--kt-pric); background-color: color-mix(in srgb, var(--kt-onpric) 10%, var(--kt-pric)); transform: scale(.94); }
.KT-tranbtn:focus { outline: none; box-shadow: var(--kt-shadow-2), inset 0 0 0 3px var(--kt-pri); }
@supports selector(:focus-visible) {
  .KT-tranbtn:focus { box-shadow: var(--kt-shadow-2); }
  .KT-tranbtn:focus-visible { outline: none; box-shadow: var(--kt-shadow-2), inset 0 0 0 3px var(--kt-pri); }
}
.KT-tranbtn svg { width: 24px; height: 24px; fill: currentColor; }
`;
