export const TRANSLATION_PANEL_STYLES = String.raw`
.kt-translation-panel.MuiPaper-root {
  overflow: visible;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-panel, 16px);
  background: var(--kt-glass, var(--kt-sf0));
  color: var(--kt-on);
  box-shadow: var(--kt-shadow-menu);
  -webkit-backdrop-filter: var(--kt-glass-blur);
  backdrop-filter: var(--kt-glass-blur);
}
.kt-translation-panel__body {
  min-width: 0;
  border-radius: 0 0 var(--kt-radius-panel, 16px) var(--kt-radius-panel, 16px);
  background: transparent;
  overflow-x: hidden;
  word-break: break-word;
  scrollbar-width: auto;
  scrollbar-color: var(--kt-scrollbar-thumb) transparent;
}
@supports not (scrollbar-color: auto) {
  .kt-translation-panel__body::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .kt-translation-panel__body::-webkit-scrollbar-track {
    background: transparent;
  }
  .kt-translation-panel__body::-webkit-scrollbar-thumb {
    background: var(--kt-scrollbar-thumb);
    background-clip: content-box;
    border-radius: 999px;
    border: 2px solid transparent;
  }
}

.kt-translation-panel--embedded.MuiPaper-root {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.kt-translation-panel--embedded .kt-translation-panel__body {
  border-radius: 0;
}

.kt-tranbox-header {
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  padding: 4px 8px 4px 10px;
  border-bottom: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-panel, 16px) var(--kt-radius-panel, 16px) 0 0;
  background: transparent;
  color: var(--kt-on);
}
.kt-tranbox-header__drag {
  display: flex;
  color: var(--kt-onv);
  cursor: move;
}
.kt-tranbox-header__drag svg { width: 18px; height: 18px; }
.kt-tranbox-header__brand {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}
.kt-tranbox-header__logo {
  flex: none;
  border-radius: var(--kt-radius-sm, 6px);
}
.kt-tranbox-header__title {
  min-width: 0;
  overflow: hidden;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 14px);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-tranbox-header__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}
.kt-tranbox-header .MuiIconButton-root {
  width: 32px;
  height: 32px;
  padding: 6px;
  border-radius: var(--kt-radius-control, 10px);
}
.kt-tranbox-header .MuiIconButton-root svg { width: 18px; height: 18px; }
.kt-tranbox-header--compact {
  flex: none;
  height: auto;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
}
.kt-tranbox-header--compact .MuiIconButton-root {
  width: 34px;
  height: 34px;
}
.kt-tranbox-header .MuiIconButton-root[aria-pressed="true"] {
  background: var(--kt-pric);
  color: var(--kt-onpric);
}
@media (hover: hover) {
  .kt-tranbox-header .MuiIconButton-root[aria-pressed="true"]:hover {
    background: color-mix(in oklab, var(--kt-onpric) 8%, var(--kt-pric));
  }
}
.kt-tranbox-header .MuiIconButton-root[aria-pressed="true"].Mui-focusVisible,
.kt-tranbox-header .MuiIconButton-root[aria-pressed="true"]:active {
  background: color-mix(in oklab, var(--kt-onpric) 10%, var(--kt-pric));
}

.kt-tranbox-header__menu {
  box-sizing: border-box;
  min-width: min(210px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: absolute;
  top: 40px;
  right: 40px;
  z-index: 4;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-liquid, var(--kt-sf0));
  box-shadow: var(--kt-shadow-menu);
  -webkit-backdrop-filter: var(--kt-liquid-blur);
  backdrop-filter: var(--kt-liquid-blur);
}
.kt-tranbox-header__menu button {
  min-height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--kt-radius-sm, 6px);
  background: transparent;
  color: var(--kt-on);
  cursor: pointer;
  font: inherit;
  font-size: var(--kt-text-body, 14px);
  font-weight: 500;
  text-align: left;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-tranbox-header__menu button[aria-checked="true"] {
  background: var(--kt-pric);
  color: var(--kt-onpric);
  font-weight: 600;
}
.kt-tranbox-header__menu button:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) {
  .kt-tranbox-header__menu button:not(:disabled):hover {
    background: var(--kt-sf1);
    color: var(--kt-on);
  }
  .kt-tranbox-header__menu button[aria-checked="true"]:not(:disabled):hover {
    background: var(--kt-pric);
    color: var(--kt-onpric);
  }
}
.kt-tranbox-header__menu svg { width: 18px; height: 18px; flex: none; }

.kt-tranbox-content {
  container-type: inline-size;
  container-name: kt-translation-content;
  padding: 12px 14px 14px;
  background: transparent;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 14px);
  line-height: 1.5;
}

/* Flat 36px config toolbar separated from content by a 1px hairline. */
.kt-translation-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-translation-toolbar__service {
  flex: 0.85 1 108px;
  min-width: 0;
}
.kt-translation-toolbar__divider {
  width: 1px;
  height: 20px;
  flex: none;
  background: var(--kt-linev);
}
.kt-translation-toolbar__langs {
  flex: 1.65 1 224px;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}
.kt-translation-toolbar__select.MuiInputBase-root {
  width: 100%;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  transition: border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-translation-toolbar__select.MuiInputBase-root:hover {
    border-color: var(--kt-line);
    background: var(--kt-sf1);
  }
}
.kt-translation-toolbar__select.MuiInputBase-root.Mui-focused {
  border-color: var(--kt-pri);
  background: var(--kt-sf0);
  box-shadow: 0 0 0 1px var(--kt-pri);
}
.kt-translation-toolbar__select .MuiSelect-select.MuiInputBase-input {
  min-height: 0;
  padding: 6px 26px 6px 10px;
  font-size: var(--kt-text-sm, 13px);
  font-weight: 500;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-translation-toolbar__select .MuiSelect-icon {
  right: 4px;
  color: var(--kt-onv);
}
.kt-translation-toolbar__swap.MuiIconButton-root {
  width: 32px;
  height: 32px;
  padding: 5px;
  justify-self: center;
}
.kt-translation-toolbar__swap.MuiIconButton-root.Mui-disabled {
  color: var(--kt-line);
  opacity: 0.65;
}
.kt-translation-config-actions {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
}

@container kt-translation-content (width < 460px) {
  .kt-translation-toolbar {
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .kt-translation-toolbar__service {
    flex: 1 1 calc(100% - 44px);
  }
  .kt-translation-toolbar__divider {
    display: none;
  }
  .kt-translation-toolbar__langs {
    flex: 1 1 100%;
  }
}

.kt-translation-panel__body .MuiFilledInput-root {
  border-radius: var(--kt-radius-control, 10px);
}
.kt-translation-panel__body .MuiInputBase-input {
  font-size: var(--kt-text-body, 14px);
  line-height: 1.6;
}
.kt-translation-panel__body .MuiFormHelperText-root {
  margin-inline: 2px;
}
.kt-translation-panel__body .MuiAlert-root {
  border-radius: var(--kt-radius-surface, 12px);
}
.kt-translation-panel__body .MuiCircularProgress-root {
  color: var(--kt-pri);
}

/* Editorial selectable reading block for translation output. */
.kt-translation-result {
  position: relative;
  display: flow-root;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf1);
  color: var(--kt-on);
}
.kt-translation-result--error {
  padding: 0;
  border: 0;
  background: transparent;
}
.kt-translation-result__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 6px;
}
.kt-translation-result__bar--floating {
  margin-bottom: 0;
  justify-content: flex-end;
  float: right;
  margin-inline-start: 8px;
  margin-top: -4px;
  margin-inline-end: -6px;
}
.kt-translation-result__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.kt-translation-result__label {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-translation-result__actions {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
}
.kt-translation-result__text {
  margin: 0;
  max-width: 65ch;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 14px);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}
.kt-translation-result__placeholder {
  margin: 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  line-height: 1.5;
}
.kt-translation-result--empty {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/* Dictionary and suggestion panes locked to 15 / 14 / 13px. */
.kt-dict-section-title {
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 13px);
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 6px;
}
.kt-dict-list {
  margin: 4px 0 0;
  padding-inline-start: 18px;
  font-size: var(--kt-text-body, 14px);
  line-height: 1.6;
  max-width: 65ch;
}
.kt-dict-list li + li {
  margin-top: 4px;
}
.kt-dict-pos {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  font-weight: 600;
  margin-inline-end: 6px;
}
.kt-dict-example {
  max-width: 65ch;
  font-size: var(--kt-text-body, 14px);
  line-height: 1.6;
}
.kt-dict-example + .kt-dict-example {
  margin-top: 8px;
}
.kt-dict-example__trans {
  margin-top: 2px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  font-style: normal;
  line-height: 1.5;
}
.kt-dict-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: var(--kt-text-sm, 13px);
  line-height: 1.45;
}
.kt-dict-meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.kt-dict-meta-label {
  color: var(--kt-onv);
  font-weight: 500;
}
.kt-dict-meta-value {
  color: var(--kt-on);
  font-weight: 500;
}
.kt-sug-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.kt-sug-list__item {
  padding: 6px 0;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-sug-list__item:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.kt-sug-list__term {
  color: var(--kt-on);
  font-size: var(--kt-text-body, 14px);
  font-weight: 600;
  line-height: 1.45;
}
.kt-sug-list__desc {
  margin-top: 2px;
  max-width: 65ch;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 13px);
  line-height: 1.5;
}
`;
