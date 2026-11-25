import {
  SETTINGS_FONT_SIZE,
  SETTINGS_HEADING_SIZE,
  SETTINGS_HELPER_FONT_SIZE,
} from "./typography";

const NARROW_OPTIONS_MAIN_STYLES = String.raw`
  .kt-overview-strip { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
  .kt-overview-strip__status { flex: 0 1 auto; flex-wrap: wrap; gap: 2px 8px; }
  .kt-overview-strip__facts { width: 100%; justify-content: flex-start; flex-wrap: wrap; gap: 8px 20px; padding-top: 0; border-top: 0; }
  .kt-overview-strip__fact + .kt-overview-strip__fact { padding-inline-start: 0; border-inline-start: 0; }
  .kt-overview-strip__action { width: 100%; margin-inline-start: 0; }
  .kt-overview-strip__link { margin-inline: -6px 0; }
  .kt-sync-methods { grid-template-columns: 1fr; }
  .kt-fab-appearance-layout { grid-template-columns: 1fr; gap: 18px; }
  .kt-settings-row { align-items: flex-start; flex-direction: column; gap: 10px; padding: 12px 10px; }
  .kt-settings-row__control { width: 100%; min-width: 0; max-width: none; justify-content: stretch; }
  .kt-settings-row__control .kt-settings-select,
  .kt-settings-segmented,
  .kt-settings-range { width: 100%; max-width: none; }
  .kt-settings-segmented > button { padding-inline: 8px; }
  .kt-settings-segmented--trigger { grid-template-columns: repeat(2, minmax(0, 1fr)); display: grid; border-radius: var(--kt-radius-control, 10px); }
`;

export const OPTIONS_STYLES = String.raw`
.kt-options-shell {
  --kt-settings-heading-size: ${SETTINGS_HEADING_SIZE / 16}rem;
  --kt-settings-font-size: ${SETTINGS_FONT_SIZE / 16}rem;
  --kt-settings-helper-font-size: ${SETTINGS_HELPER_FONT_SIZE / 16}rem;
  --kt-settings-control-width: 260px;
  min-height: 100vh;
  background: var(--kt-bg);
  color: var(--kt-on);
}
.kt-options-background { position: relative; z-index: 0; }
.kt-options-compact-header { display: none; }
.kt-options-layout { min-height: 100vh; display: grid; grid-template-columns: 256px minmax(0, 1fr); }
.kt-options-sidebar {
  width: 256px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  z-index: 20;
  overflow: hidden;
  border-right: 1px solid var(--kt-linev);
  background: var(--kt-sf0);
}
.kt-options-brand-row {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kt-space-xs, 8px);
  padding: 14px 12px 10px 18px;
}
.kt-options-brand {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--kt-on);
  text-decoration: none;
  border-radius: var(--kt-radius-control, 10px);
}
.kt-options-brand img { border-radius: var(--kt-radius-sm, 6px); flex: none; }
.kt-options-brand__name {
  display: block;
  min-width: 0;
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-options-search {
  display: flex;
  align-items: center;
  gap: var(--kt-space-xs, 8px);
  min-height: 36px;
  margin: 0 14px 12px;
  padding: 0 12px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-bg);
  color: var(--kt-onv);
  transition: border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-options-search:hover { border-color: var(--kt-line); }
.kt-options-search:focus-within {
  border-color: var(--kt-pri);
  background: var(--kt-sf0);
  box-shadow: 0 0 0 1px var(--kt-pri);
}
@media (forced-colors: active) {
  .kt-options-search:focus-within { outline: 2px solid Highlight; outline-offset: 1px; }
}
.kt-options-search svg { width: 18px; height: 18px; flex: none; color: var(--kt-onv); }
.kt-options-search input {
  width: 100%;
  min-height: 34px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  line-height: 1.4;
}
.kt-options-search input::placeholder { color: var(--kt-onv); opacity: 1; }
.kt-m3-root .kt-options-search input:focus { outline: none; }
@supports selector(:focus-visible) {
  .kt-m3-root .kt-options-search input:focus-visible { outline: none; }
}
.kt-options-nav { flex: 1; overflow-y: auto; padding: 4px 10px 16px; }
.kt-options-nav__group { margin-top: 16px; }
.kt-options-nav__group:first-child { margin-top: 0; }
.kt-options-nav__label {
  margin: 0 10px 6px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
  text-transform: none;
}
.kt-options-nav__list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.kt-options-nav__link {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--kt-radius-control, 10px);
  color: var(--kt-onv);
  text-decoration: none;
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  line-height: 1.35;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-options-nav__link:hover { background: var(--kt-sf1); color: var(--kt-on); }
}
@media (prefers-reduced-motion: no-preference) {
  .kt-options-nav__link {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .kt-options-nav__link:active { transform: scale(0.99); }
}
.kt-options-nav__link.active {
  background: var(--kt-pric);
  color: var(--kt-onpric);
  font-weight: 600;
}
.kt-options-nav__link svg { width: 18px; height: 18px; flex: none; }
.kt-options-nav__empty {
  padding: 24px 14px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  text-align: center;
}
.kt-options-sidebar__footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--kt-linev);
}
.kt-options-sidebar__footer .kt-options-nav__link { flex: 1; min-width: 0; }
.kt-options-sidebar__version {
  flex: none;
  padding-inline-end: 6px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.kt-options-sidebar__close {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--kt-radius-control, 10px);
  background: transparent;
  color: var(--kt-onv);
  cursor: pointer;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-options-sidebar__close:hover { background: var(--kt-sf1); color: var(--kt-on); }
}
.kt-options-sidebar__close svg { width: 20px; height: 20px; }
.kt-options-overlay { display: none; }

.kt-options-main {
  min-width: 0;
  padding: 32px clamp(24px, 4.5vw, 64px) 72px;
  container-name: options-main;
  container-type: inline-size;
}
.kt-options-main__inner { width: min(790px, 100%); margin: 0 auto; }
.kt-options-main__inner--wide { width: min(1120px, 100%); }
.kt-options-page-header { margin: 0 0 22px; }
.kt-options-page-header h1 {
  margin: 0;
  color: var(--kt-on);
  font-size: 1.625rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
}
:lang(zh) .kt-options-page-header h1 { letter-spacing: -0.01em; }
.kt-options-page-header p {
  margin: 6px 0 0;
  max-width: 65ch;
  color: var(--kt-onv);
  font-size: var(--kt-text-body, 0.875rem);
  line-height: 1.5;
}
.kt-options-page { min-width: 0; }

.kt-options-page .MuiAlert-root {
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf0);
  color: var(--kt-on);
}
.kt-options-page .MuiTextField-root { min-width: 0; }
.kt-options-page .MuiInputLabel-root.MuiInputLabel-shrink {
  max-width: calc(125% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-options-page .MuiFormControlLabel-root { min-height: 36px; gap: 8px; margin-inline: 0; }
.kt-options-page .MuiFormControlLabel-label {
  font-size: var(--kt-settings-font-size);
  font-weight: 500;
}
.kt-options-page .MuiAccordion-root {
  border: 0;
  border-bottom: 1px solid var(--kt-linev);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.kt-options-page .MuiAccordion-root.Mui-expanded { margin-block: 0; }
.kt-options-page .MuiAccordion-root:not(:last-child) { margin-bottom: 4px; }
.kt-options-page .kt-rule-accordion {
  display: flex;
  align-items: flex-start;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-options-page .kt-rule-accordion:not(:last-child) { margin-bottom: 4px; }
.kt-options-page .kt-rule-accordion .MuiAccordion-root {
  flex: 1;
  min-width: 0;
  border-bottom: 0;
  margin-bottom: 0;
}
.kt-options-page .kt-rule-enable-control {
  min-height: 52px;
  display: flex;
  align-items: center;
  flex: none;
  padding-inline: 8px 4px;
}
.kt-options-page .MuiAccordionSummary-root { min-height: 52px; padding-inline: 12px; }
.kt-options-page .kt-rule-accordion--with-switch .MuiAccordionSummary-root { padding-inline-start: 8px; }
.kt-options-page .MuiButton-root { white-space: nowrap; }
.kt-options-page .MuiTabs-root { width: fit-content; max-width: 100%; }
.kt-options-page img { max-width: 100%; height: auto; }
.kt-options-page pre,
.kt-options-page table { max-width: 100%; display: block; overflow: auto; }
.kt-options-page pre {
  padding: 14px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  font-family: var(--kt-font-mono);
  font-size: var(--kt-text-sm, 0.8125rem);
}
.kt-options-page code,
.kt-options-page a { overflow-wrap: anywhere; }
.kt-options-page pre > code { min-width: 100%; display: block; overflow-wrap: normal; }

.kt-settings-section { margin-top: 28px; }
.kt-settings-section:first-child { margin-top: 0; }
.kt-settings-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 10px;
}
.kt-options-section-title,
.kt-settings-section__header > h2,
.kt-settings-section > h2 {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-settings-heading-size);
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  line-height: 1.35;
}
.kt-settings-section > h2 { margin-bottom: 10px; }
.kt-settings-section__action { flex: none; display: flex; align-items: center; gap: 8px; }

.kt-settings-card {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--kt-linev);
  border-bottom: 1px solid var(--kt-linev);
  background: transparent;
}
.kt-settings-row {
  position: relative;
  width: auto;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 11px 10px;
  margin-inline: -10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-settings-row:not(:last-child)::after {
  content: "";
  position: absolute;
  inset-inline: 10px;
  bottom: 0;
  height: 1px;
  background: var(--kt-linev);
  pointer-events: none;
}
@media (hover: hover) {
  .kt-settings-row:hover {
    background: var(--kt-sf1);
    border-radius: var(--kt-radius-control, 10px);
  }
  .kt-settings-row:hover::after {
    opacity: 0;
  }
}
.kt-settings-row__copy { min-width: 0; flex: 1; }
.kt-settings-row__label {
  display: block;
  color: var(--kt-on);
  font-size: var(--kt-settings-font-size);
  font-weight: 500;
  line-height: 1.4;
}
label.kt-settings-row__label { cursor: pointer; }
.kt-settings-row__desc {
  display: block;
  margin-top: 3px;
  max-width: 60ch;
  color: var(--kt-onv);
  font-size: var(--kt-settings-helper-font-size);
  line-height: 1.45;
}
.kt-settings-row__control {
  width: var(--kt-settings-control-width);
  min-width: 0;
  max-width: 56%;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.kt-settings-row__control:where(:has(> .kt-settings-segmented)) {
  width: auto;
  min-width: var(--kt-settings-control-width);
  max-width: 62%;
}
.kt-settings-row__control > .MuiFormControl-root { width: 100%; }
.kt-settings-row__control .MuiInputBase-root { font-size: var(--kt-settings-font-size); }
.kt-settings-row__control .MuiFilledInput-root { min-height: 38px; }
.kt-settings-row__control .MuiFilledInput-input:not(textarea) { padding-block: 8px; }
.kt-settings-row--stacked { align-items: flex-start; flex-direction: column; gap: 10px; }
.kt-settings-row--stacked .kt-settings-row__control { width: 100%; min-width: 0; max-width: none; justify-content: stretch; }
.kt-settings-row__control .kt-settings-select { width: 100%; min-width: 0; max-width: 100%; }
.kt-settings-select .MuiFilledInput-root { min-height: 38px; }
.kt-settings-select .MuiSelect-select {
  padding: 8px 32px 8px 12px;
  color: var(--kt-on);
  font-size: var(--kt-settings-font-size);
  font-weight: 500;
  text-overflow: ellipsis;
}

.kt-settings-segmented {
  position: relative;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
  gap: 2px;
  overflow: hidden;
  padding: 3px;
  border: 0;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf2);
  box-shadow: none;
}
.kt-settings-segmented > button {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 30px;
  flex: 1 1 auto;
  overflow: hidden;
  padding: 4px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--kt-onv);
  font-size: var(--kt-settings-font-size);
  font-weight: 500;
  line-height: 1.35;
  text-transform: none;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  white-space: normal;
}
.kt-settings-segmented > button.MuiToggleButtonGroup-grouped {
  border: 0;
  margin-left: 0;
  border-radius: 8px;
}
.kt-settings-segmented > button.Mui-selected {
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-weight: 600;
  box-shadow: var(--kt-shadow-card);
}
@media (hover: hover) {
  .kt-settings-segmented > button:hover {
    background: var(--kt-sf1);
    color: var(--kt-on);
  }
  .kt-settings-segmented > button.Mui-selected:hover {
    background: var(--kt-sf0);
  }
}
.kt-settings-segmented__label { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.kt-settings-segmented--numeric .kt-settings-segmented__label { font-variant-numeric: tabular-nums; }
.kt-settings-segmented > button svg { width: 16px; height: 16px; flex: none; }
.kt-settings-segmented > button:focus { outline: none; box-shadow: inset 0 0 0 2px var(--kt-pri); }
@supports selector(:focus-visible) {
  .kt-settings-segmented > button:focus { box-shadow: none; }
  .kt-settings-segmented > button:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--kt-pri); }
}
@media (forced-colors: active) {
  .kt-settings-segmented > button:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }
  .kt-settings-segmented > button.Mui-selected {
    border: 1px solid Highlight;
  }
}

.kt-settings-range {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(100px, 1fr) max-content;
  align-items: center;
  gap: 12px;
}
.kt-settings-range .MuiSlider-root { color: var(--kt-pri); }
.kt-settings-range output,
.kt-settings-range__output {
  min-width: 64px;
  padding: 5px 8px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-sm, 6px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-family: var(--kt-font-sans);
  font-variant-numeric: tabular-nums;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

.kt-settings-keys {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
}
.kt-settings-keys kbd {
  min-width: 26px;
  padding: 3px 7px;
  border: 1px solid var(--kt-line);
  border-bottom-width: 2px;
  border-radius: var(--kt-radius-sm, 6px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-family: var(--kt-font-sans);
  font-variant-numeric: tabular-nums;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}
.kt-settings-keys--empty {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
}

/* Compact 1-line collapsible usage note replacing page-top Alert walls. */
.kt-settings-disclosure {
  margin: 0 0 16px;
}
.kt-settings-disclosure__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px 4px 6px;
  border: 0;
  border-radius: var(--kt-radius-control, 10px);
  background: transparent;
  color: var(--kt-onv);
  font: inherit;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-settings-disclosure__trigger:hover {
    background: var(--kt-sf1);
    color: var(--kt-on);
  }
}
.kt-settings-disclosure__icon {
  width: 18px;
  height: 18px;
  transform: rotate(-90deg);
}
@media (prefers-reduced-motion: no-preference) {
  .kt-settings-disclosure__icon {
    transition: transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-settings-disclosure--open .kt-settings-disclosure__icon {
  transform: rotate(0deg);
}
.kt-settings-disclosure__content {
  margin-top: 8px;
  padding: 12px 16px;
  max-width: 65ch;
  border-inline-start: 2px solid var(--kt-line);
  border-radius: 0 var(--kt-radius-control, 10px) var(--kt-radius-control, 10px) 0;
  background: var(--kt-sf1);
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.55;
}
.kt-settings-disclosure__content p { margin: 0; }
.kt-settings-disclosure__content p + p { margin-top: 6px; }
.kt-settings-disclosure__content ul { margin: 0; padding-inline-start: 18px; }
.kt-settings-disclosure__content li + li { margin-top: 4px; }

.kt-settings-advanced-shell { margin-top: 16px; }
.kt-settings-advanced.MuiAccordion-root,
.kt-settings-advanced.MuiAccordion-root.Mui-expanded {
  margin: 0;
  overflow: hidden;
  border: 0;
  border-bottom: 1px solid var(--kt-linev);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.kt-settings-advanced .MuiAccordionSummary-root {
  min-height: 44px;
  padding: 0 4px;
  color: var(--kt-pri);
  font-size: var(--kt-settings-font-size);
  font-weight: 600;
}
.kt-settings-advanced .MuiAccordionSummary-content { margin-block: 10px; }
.kt-settings-advanced .MuiAccordionSummary-expandIconWrapper { color: var(--kt-pri); }
.kt-settings-advanced .kt-settings-advanced__content {
  padding: 8px 4px 16px;
  border-top: 1px solid var(--kt-linev);
}
.kt-settings-advanced-shell--rows .kt-settings-advanced__content { padding: 0; }
.kt-settings-advanced__rows { margin: 0; padding: 0; list-style: none; }
.kt-settings-advanced__content > .MuiTextField-root { width: 100%; margin-top: 12px; }
.kt-settings-card .MuiButton-root { padding-inline: 14px; }
.kt-settings-card .MuiSwitch-root { margin-inline: 2px; }

.kt-shortcut-input { width: 100%; min-width: 0; align-items: center; }
.kt-shortcut-input .MuiTextField-root { min-width: 0; }
.kt-shortcut-input .MuiFilledInput-root {
  min-height: 38px;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
}
.kt-shortcut-input--idle .MuiFilledInput-root {
  border-color: var(--kt-line);
  cursor: pointer;
}
.kt-shortcut-input--idle .MuiFilledInput-input {
  color: var(--kt-on);
  cursor: pointer;
}
.kt-shortcut-input--editing .MuiFilledInput-root {
  border-color: var(--kt-pri);
  box-shadow: 0 0 0 1px var(--kt-pri);
}
.kt-shortcut-input .MuiFilledInput-input {
  font-family: var(--kt-font-sans);
  font-variant-numeric: tabular-nums;
  font-size: var(--kt-settings-font-size);
  font-weight: 600;
}
.kt-shortcut-input--compact .MuiFilledInput-input {
  padding-block: 8px;
}
.kt-shortcut-input .MuiIconButton-root { width: 34px; height: 34px; flex: none; }

/* Numeric inputs use tabular numerals in body sans so values stay aligned while editing. */
.kt-options-page input[inputmode="numeric"],
.kt-options-page input[inputmode="decimal"] {
  font-variant-numeric: tabular-nums;
}

/* Compact single-line overview status strip replacing the old 200px hero banner. */
.kt-overview-strip {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 10px;
  margin: 0 0 24px;
  padding: 12px 14px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf0);
  color: var(--kt-on);
}
.kt-overview-strip--warn {
  border-color: var(--kt-warn);
  background: var(--kt-warnc);
  color: var(--kt-onwarnc);
}
.kt-overview-strip__status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: none;
}
.kt-overview-strip--warn .kt-overview-strip__status {
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.kt-overview-strip__dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--kt-grn);
}
.kt-overview-strip--warn .kt-overview-strip__dot { background: var(--kt-warn); }
.kt-overview-strip__title {
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.kt-overview-strip__meta {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  white-space: nowrap;
}
.kt-overview-strip--warn .kt-overview-strip__meta {
  color: inherit;
  white-space: normal;
}
.kt-overview-strip__facts {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  min-width: 0;
  flex: 1 1 auto;
  justify-content: flex-end;
}
.kt-overview-strip__fact {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
.kt-overview-strip__fact + .kt-overview-strip__fact {
  padding-inline-start: 8px;
  border-inline-start: 1px solid var(--kt-linev);
}
.kt-overview-strip__fact dt {
  margin: 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  white-space: nowrap;
}
.kt-overview-strip__fact dd {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 190px;
}
.kt-overview-strip__action { flex: none; margin-inline-start: auto; }
.kt-overview-strip__link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 4px 6px;
  margin-inline-end: -6px;
  border-radius: var(--kt-radius-sm, 6px);
  color: var(--kt-pri);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-overview-strip__link:hover {
    background: var(--kt-pric);
    color: var(--kt-onpric);
  }
}

/* Shared Wave 2 workspace primitives: master-detail rail, inline statuses, toolbars, preview stages. */
.kt-master-detail {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  min-width: 0;
}
.kt-master-rail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  padding: 8px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf1);
}
.kt-master-rail__header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-master-rail__list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  scrollbar-gutter: stable;
}
.kt-master-rail__group {
  margin: 10px 8px 4px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-master-rail__group:first-child { margin-top: 2px; }
.kt-master-rail__empty {
  padding: 20px 12px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  text-align: center;
}
.kt-master-row {
  position: relative;
  min-width: 0;
  width: 100%;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-master-row:last-child { border-bottom: 0; }
.kt-master-row__btn.MuiListItemButton-root {
  min-width: 0;
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  gap: 8px;
  border-radius: var(--kt-radius-control, 10px);
  background: transparent;
  color: var(--kt-on);
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-master-row__btn.MuiListItemButton-root:hover {
    background: var(--kt-sf0);
  }
}
.kt-master-row__btn.MuiListItemButton-root.Mui-selected {
  background: var(--kt-pric);
  color: var(--kt-onpric);
}
.kt-master-row__btn.MuiListItemButton-root.Mui-selected:hover {
  background: var(--kt-pric);
}
.kt-master-row__btn.MuiListItemButton-root.Mui-selected .kt-master-row__secondary {
  color: var(--kt-onpric);
}
.kt-master-row__btn--dragover.MuiListItemButton-root {
  box-shadow: inset 0 0 0 2px var(--kt-pri);
}
.kt-master-row__title {
  display: block;
  min-width: 0;
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.kt-master-row__secondary {
  display: block;
  margin-top: 2px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-master-row__secondary--warn {
  color: var(--kt-err);
  font-weight: 600;
}
.kt-master-detail-pane {
  min-width: 0;
  padding: 4px 0 24px;
}
.kt-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  margin-bottom: 16px;
}
.kt-toolbar-row__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.kt-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf1);
}
.kt-bulk-bar__count {
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--kt-on);
}
.kt-field-subgroup {
  padding-top: 18px;
  border-top: 1px solid var(--kt-linev);
}
.kt-field-subgroup__title {
  margin: 0 0 12px;
  color: var(--kt-on);
  font-size: var(--kt-text-heading, 0.9375rem);
  font-weight: 600;
  line-height: 1.35;
}
.kt-inline-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-inline-status--ok { color: var(--kt-grn); }
.kt-inline-status--warn { color: var(--kt-warn); }
.kt-inline-status--err { color: var(--kt-err); }
.kt-preview-stage {
  padding: 18px 20px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf0);
}
.kt-preview-stage__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 14px;
}
.kt-preview-stage__title {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-preview-stage__toggle {
  width: auto;
  min-width: 188px;
}

/* StylesSetting live bilingual reading workbench */
.kt-style-stage__canvas {
  padding: 20px 22px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-style-stage__source,
.kt-style-stage__translation {
  margin: 0;
  max-width: 65ch;
  font-size: var(--kt-text-heading, 0.9375rem);
  line-height: 1.65;
}
.kt-style-stage__translation { margin-top: 8px; }
.kt-style-workbench {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.kt-style-list-btn.MuiListItemButton-root {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px;
  min-height: 60px;
}
.kt-style-list-btn__name {
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.kt-style-list-btn__sample {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.45;
  color: var(--kt-onv);
}
.kt-style-list-btn.Mui-selected .kt-style-list-btn__sample {
  color: var(--kt-onpric);
}

/* Subtitle live cinema preview & aligned style controls */
.kt-subtitle-stage__canvas {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 156px;
  padding: 20px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  overflow: hidden;
}
.kt-subtitle-stage__canvas--dark {
  background: linear-gradient(180deg, #1b212b 0%, #11151c 100%);
}
.kt-subtitle-stage__canvas--light {
  background: linear-gradient(180deg, #eff2f6 0%, #dde3ec 100%);
}
.kt-subtitle-controls {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.kt-subtitle-group {
  padding-top: 16px;
  border-top: 1px solid var(--kt-linev);
}
.kt-subtitle-group:first-child {
  padding-top: 0;
  border-top: 0;
}
.kt-subtitle-group__title {
  margin: 0 0 12px;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-subtitle-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.kt-subtitle-slider-row__label {
  min-width: 64px;
  flex: none;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.4;
}
.kt-subtitle-slider-row__value {
  min-width: 44px;
  flex: none;
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.kt-color-swatch {
  width: 38px;
  height: 38px;
  flex: none;
  padding: 0;
  border: 1px solid var(--kt-line);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  cursor: pointer;
}
.kt-color-swatch::-webkit-color-swatch-wrapper { padding: 3px; }
.kt-color-swatch::-webkit-color-swatch { border: 0; border-radius: 6px; }
.kt-color-swatch::-moz-color-swatch { border: 0; border-radius: 6px; }

/* FabAppearanceSetting neutral desktop webpage-edge preview */
.kt-fab-appearance {
  margin-top: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-fab-appearance__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 14px;
}
.kt-fab-appearance__title {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-fab-appearance-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}
.kt-fab-preview,
.kt-fab-appearance-controls { min-width: 0; }
.kt-fab-preview-stage {
  position: relative;
  height: 164px;
  overflow: hidden;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-bg);
}
.kt-fab-preview-page {
  position: absolute;
  inset: 16px 40px 36px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.kt-fab-preview-line {
  height: 8px;
  border-radius: 4px;
  background: var(--kt-sf3);
}
.kt-fab-preview-line--short { width: 64%; }
.kt-fab-preview-line--mid { width: 84%; }
.kt-fab-preview-dock {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
}
.kt-fab-preview-dock--half-hide {
  right: 0;
  transform: translate(50%, -50%);
}
.kt-fab-preview-dock--half-hide.kt-fab-preview-dock--active {
  right: 12px;
  transform: translate(0, -50%);
}
.kt-fab-preview-opacity {
  display: grid;
  place-items: center;
  transition: opacity var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (prefers-reduced-motion: no-preference) {
  .kt-fab-preview-dock {
    transition: transform var(--kt-dur, 150ms) var(--kt-ease, ease-out), right var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-fab-preview-dimensions {
  position: absolute;
  left: 12px;
  bottom: 10px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  pointer-events: none;
}
.kt-fab-appearance-controls { display: grid; gap: 18px; }
.kt-fab-appearance-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.kt-fab-appearance-label-row > label {
  min-width: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.kt-fab-appearance-label-row > output {
  flex: none;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
  white-space: nowrap;
}
.kt-fab-appearance .MuiSlider-root { display: block; width: 100%; }
.kt-fab-appearance-helper {
  margin: 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.kt-fab-appearance-refresh {
  margin: 12px 0 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.45;
}

/* Prompts compact variable insert header */
.kt-prompt-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kt-prompt-field-header__label {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
}

.kt-empty-state {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 1px dashed var(--kt-line);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf0);
  color: var(--kt-onv);
  text-align: center;
  font-size: var(--kt-text-body, 0.875rem);
}

.kt-api-master-detail { min-width: 0; }
.kt-api-list { margin: 0; padding: 0; list-style: none; scrollbar-gutter: stable; }
.kt-api-list__item,
.kt-api-list__card { min-width: 0; width: 100%; }
.kt-api-provider-icon {
  width: 34px;
  height: 34px;
  border: 1px solid var(--kt-linev);
  border-radius: 50%;
  background: var(--kt-sf0);
}
.kt-m3-root[data-theme="dark"] .kt-api-provider-icon {
  background: var(--kt-sf3);
}
.kt-api-detail {
  min-width: 0;
  padding: 4px 0 22px;
  border: 0;
  border-bottom: 1px solid var(--kt-linev);
  border-radius: 0;
  background: transparent;
}
@media (prefers-reduced-motion: no-preference) {
  .kt-api-detail { animation: kt-m3-rise var(--kt-dur, 150ms) var(--kt-ease, ease-out); }
}
.kt-api-detail__header { padding-bottom: 14px; border-bottom: 1px solid var(--kt-linev); }
.kt-api-detail__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.4;
}
.kt-api-detail__footer { padding-top: 14px; border-top: 1px solid var(--kt-linev); }
.kt-api-detail__primary-actions,
.kt-api-detail__secondary-actions,
.kt-api-detail__status-actions { flex-wrap: wrap; }
.kt-api-key-block { min-width: 0; width: 100%; }
.kt-api-key-field-wrap { min-width: 0; width: 100%; }
.kt-api-key-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap; }
.kt-api-key-header__label {
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
}
.kt-test-connection {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--kt-radius-control, 10px);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.45;
}
.kt-test-connection--ok { color: var(--kt-ongrnc); background: var(--kt-grnc); }
.kt-test-connection--fail { color: var(--kt-onerrc); background: var(--kt-errc); }

.kt-sync-methods {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  overflow: hidden;
  background: var(--kt-sf0);
}
.kt-sync-method {
  min-height: 104px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border: 0;
  border-inline-start: 1px solid var(--kt-linev);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--kt-on);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
.kt-sync-method:first-child { border-inline-start: 0; }
@media (hover: hover) {
  .kt-sync-method:hover { background: var(--kt-sf1); }
}
@media (prefers-reduced-motion: no-preference) {
  .kt-sync-method:active { transform: scale(0.99); }
}
.kt-sync-method[aria-checked="true"] {
  background: var(--kt-pric);
  box-shadow: inset 0 0 0 2px var(--kt-pri);
  color: var(--kt-onpric);
}
@media (forced-colors: active) {
  .kt-sync-method[aria-checked="true"] { outline: 2px solid Highlight; outline-offset: -2px; }
}
.kt-sync-method svg { width: 22px; height: 22px; color: var(--kt-pri); }
.kt-sync-method[aria-checked="true"] svg { color: currentColor; }
.kt-sync-method__name { font-size: var(--kt-settings-font-size); font-weight: 600; }
.kt-sync-method__description {
  color: var(--kt-onv);
  font-size: var(--kt-settings-helper-font-size);
  line-height: 1.45;
}
.kt-sync-method[aria-checked="true"] .kt-sync-method__description { color: var(--kt-onpric); }

/* Left-aligned editorial spec sheet for About page. */
.kt-about {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.kt-about__identity {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.kt-about__logo {
  flex: none;
  border-radius: var(--kt-radius-surface, 12px);
  box-shadow: var(--kt-shadow-1);
}
.kt-about__copy { min-width: 0; }
.kt-about__copy h2 {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-heading, 0.9375rem);
  font-weight: 700;
  line-height: 1.35;
}
.kt-about__copy p {
  margin: 6px 0 0;
  max-width: 65ch;
  color: var(--kt-onv);
  font-size: var(--kt-text-body, 0.875rem);
  line-height: 1.55;
}
.kt-about__meta {
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--kt-linev);
  border-bottom: 1px solid var(--kt-linev);
}
.kt-about__meta-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  align-items: baseline;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-about__meta-row:last-child { border-bottom: 0; }
.kt-about__meta-row dt {
  margin: 0;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
}
.kt-about__meta-row dd {
  margin: 0;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
}
.kt-about__link {
  color: var(--kt-pri);
  font-weight: 600;
  text-decoration: none;
}
.kt-about__link:hover { text-decoration: underline; }
.kt-about__actions { display: flex; align-items: center; gap: 12px; }

@media (max-width: 1179px) and (min-width: 901px) {
  .kt-options-layout { grid-template-columns: 224px minmax(0, 1fr); }
  .kt-options-sidebar { width: 224px; }
  .kt-options-brand-row { padding-inline: 14px 8px; }
  .kt-options-search { margin-inline: 12px; padding-inline: 10px; }
}

@media (max-width: 900px) {
  .kt-options-layout { display: block; }
  .kt-options-compact-header {
    min-height: 54px;
    display: flex;
    align-items: center;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 8px 14px;
    border-bottom: 1px solid transparent;
    background: var(--kt-bg);
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .kt-options-compact-header--scrolled {
    border-bottom-color: var(--kt-linev);
    background: var(--kt-sf0);
    box-shadow: var(--kt-shadow-card);
  }
  .kt-options-compact-header__brand {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--kt-on);
    text-decoration: none;
  }
  .kt-options-compact-header__name {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kt-options-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 256px;
    z-index: 40;
    transform: translateX(-105%);
    visibility: hidden;
    pointer-events: none;
    box-shadow: var(--kt-shadow-menu);
  }
  .kt-options-sidebar--open {
    transform: translateX(0);
    visibility: visible;
    pointer-events: auto;
  }
  .kt-options-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 35;
    border: 0;
    background: var(--kt-scrim);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .kt-options-overlay--open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }
  @media (prefers-reduced-motion: no-preference) {
    .kt-options-sidebar {
      transition: transform var(--kt-dur-slow, 220ms) var(--kt-ease, ease-out), visibility 0s linear var(--kt-dur-slow, 220ms);
    }
    .kt-options-sidebar--open {
      transition: transform var(--kt-dur-slow, 220ms) var(--kt-ease, ease-out), visibility 0s linear 0s;
    }
    .kt-options-overlay {
      transition: opacity var(--kt-dur-slow, 220ms) var(--kt-ease, ease-out), visibility 0s linear var(--kt-dur-slow, 220ms);
    }
    .kt-options-overlay--open {
      transition: opacity var(--kt-dur-slow, 220ms) var(--kt-ease, ease-out), visibility 0s linear 0s;
    }
  }
  .kt-options-main { padding: 24px 18px 56px; }
  .kt-master-detail,
  .kt-style-workbench { grid-template-columns: 1fr; }
  .kt-master-rail { position: static; max-height: min(44vh, 340px); }
}

@container options-main (max-width: 789px) {
  .kt-overview-strip {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px 14px;
  }
  .kt-overview-strip__status {
    grid-column: 1;
    grid-row: 1;
    flex-wrap: wrap;
    gap: 2px 8px;
  }
  .kt-overview-strip__action {
    grid-column: 2;
    grid-row: 1;
    margin-inline-start: 0;
  }
  .kt-overview-strip__facts {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px 20px;
    padding-top: 8px;
    border-top: 1px solid var(--kt-linev);
  }
  .kt-overview-strip__fact + .kt-overview-strip__fact {
    padding-inline-start: 0;
    border-inline-start: 0;
  }
  .kt-overview-strip__fact dd {
    max-width: none;
  }
}

@container options-main (max-width: 720px) {
  .kt-master-detail,
  .kt-style-workbench { grid-template-columns: 1fr; }
  .kt-master-rail { position: static; max-height: min(44vh, 340px); }
}

@container options-main (max-width: 620px) {
${NARROW_OPTIONS_MAIN_STYLES}
}

@supports not (container-type: inline-size) {
  @media (max-width: 656px) {
${NARROW_OPTIONS_MAIN_STYLES}
  }
}
`;
