export const POPUP_STYLES = String.raw`
.kt-popup-shell {
  width: 396px;
  /* A percentage cap preserves toolbar popup intrinsic sizing; viewport units
     can lock the browser's initially narrow measurement viewport in place. */
  max-width: 100%;
  min-width: 0;
  overflow: visible;
  background: var(--kt-bg);
  color: var(--kt-on);
}

.kt-m3-root .kt-popup-shell:focus,
.kt-m3-root .kt-popup-shell:focus-visible {
  outline: none;
}

/* The native window owns the frame; translation uses the available canvas. */
.kt-popup-shell--window {
  width: 100%;
  min-width: 0;
  min-height: 100dvh;
}

.kt-popup-shell--window .kt-popup-text-panel,
.kt-popup-shell--window .kt-popup-loading {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.kt-popup-shell--window .kt-popup-text-panel {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.kt-popup-shell--window .kt-translation-panel,
.kt-popup-shell--window .kt-translation-panel__body,
.kt-popup-shell--window .kt-tranbox-content,
.kt-popup-shell--window .kt-tranbox-content > .MuiStack-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.kt-popup-shell--window .kt-translation-source textarea:not([aria-hidden="true"]) {
  min-height: 76px;
}
.kt-popup-shell--window .kt-translation-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 160px;
}
.kt-popup-shell--window .kt-translation-result__text {
  flex: 1;
  overflow-y: auto;
}

.kt-popup-chrome {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-bottom: var(--kt-space-xs, 8px);
  border-bottom: 1px solid var(--kt-linev);
  background: var(--kt-sf0);
  box-shadow: none;
}

.kt-popup-header {
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: var(--kt-space-xs, 8px);
  padding: 0 var(--kt-chrome-inset, 16px);
  background: transparent;
}

.kt-popup-header__logo {
  border-radius: var(--kt-radius-sm, 6px);
  flex: none;
}

.kt-popup-brand-button {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  border: 0;
  border-radius: var(--kt-radius-sm, 6px);
  background: transparent;
  color: var(--kt-on);
  cursor: pointer;
}

.kt-popup-header__title {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--kt-on);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kt-popup-header__spacer { flex: 1; }
.kt-popup-header__drag { display: flex; color: var(--kt-onv); cursor: move; }
.kt-popup-header__actions { display: flex; flex: none; align-items: center; gap: 2px; }
.kt-popup-header__actions .MuiIconButton-root {
  width: 34px;
  height: 34px;
  padding: 6px;
  border-radius: var(--kt-radius-control, 10px);
  color: var(--kt-onv);
}

.kt-popup-shell--window .kt-popup-window-title {
  flex: none;
  margin: 0;
  padding: 14px 16px 2px;
  color: var(--kt-on);
  font-size: var(--kt-text-heading, 0.9375rem);
  font-weight: 600;
  line-height: 1.35;
}

/* Connected 10px segmented tabs matching Options SettingsSegmented. */
.kt-popup-tabs {
  margin: 0 var(--kt-chrome-inset, 16px);
}
.kt-popup-tabs.MuiTabs-root {
  min-height: 36px;
  padding: 3px;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf2);
}
.kt-popup-tabs .MuiTab-root {
  min-height: 30px;
  padding: 4px 10px;
  border-radius: 8px;
  color: var(--kt-onv);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
}
.kt-popup-tabs .MuiTab-root.Mui-selected {
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-weight: 600;
  box-shadow: var(--kt-shadow-card);
}

.kt-popup-scroll { height: auto; overflow: visible; }
.kt-popup-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px var(--kt-chrome-inset, 16px) 14px;
}

.kt-popup-loading {
  min-height: 240px;
  display: grid;
  place-items: center;
  color: var(--kt-onv);
}

@media (prefers-reduced-motion: no-preference) {
  .kt-popup-loading svg { animation: kt-m3-spin 0.8s linear infinite; }
}

.kt-popup-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  overflow: hidden;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-pric);
  cursor: pointer;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .kt-popup-hero {
    transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
  .kt-popup-hero:not(.kt-popup-hero--disabled):not([aria-disabled="true"]):active {
    transform: scale(0.99);
  }
}

.kt-popup-hero--disabled,
.kt-popup-hero[aria-disabled="true"] { cursor: default; }
.kt-popup-hero--off {
  border-color: var(--kt-linev);
  background: var(--kt-sf0);
}

.kt-popup-hero__icon {
  width: 40px;
  height: 40px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-pri);
  color: var(--kt-onpri);
}

.kt-popup-hero__icon svg { width: 22px; height: 22px; }
.kt-popup-hero--off .kt-popup-hero__icon {
  background: var(--kt-sf2);
  color: var(--kt-onv);
}

@media (prefers-reduced-motion: no-preference) {
  .kt-popup-hero--busy .kt-popup-hero__icon svg {
    animation: kt-m3-spin 0.9s linear infinite;
  }
}

.kt-popup-hero__copy { min-width: 0; display: block; flex: 1; }
.kt-popup-hero__title {
  display: block;
  color: var(--kt-onpric);
  font-size: var(--kt-text-heading, 0.9375rem);
  font-weight: 600;
  line-height: 1.35;
}
.kt-popup-hero--off .kt-popup-hero__title { color: var(--kt-on); }

.kt-popup-hero__subtitle {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--kt-onpric);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-popup-hero--off .kt-popup-hero__subtitle { color: var(--kt-onv); }

.kt-popup-hero__progress {
  height: 3px;
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  background: color-mix(in oklab, var(--kt-pri) 20%, transparent);
}
.kt-popup-hero__progress::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 42%;
  border-radius: 999px;
  background: var(--kt-pri);
  transform-origin: left center;
}
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-hero__progress::after {
    animation: kt-m3-sweep-x 1.05s var(--kt-ease, ease-out) infinite;
  }
}

.kt-popup-key-empty {
  padding: 10px 12px;
}

.kt-popup-language-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.kt-popup-language {
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  text-align: left;
}

.kt-popup-language > span {
  display: block;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  line-height: 1.3;
  pointer-events: none;
}

.kt-popup-language .kt-popup-language-select {
  width: 100%;
  margin-top: 2px;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 600;
}

.kt-popup-language-select {
  border-radius: var(--kt-radius-sm, 6px);
}

.kt-popup-language .kt-popup-language-select .MuiSelect-select.MuiInputBase-input {
  min-height: 0;
  padding: 0 22px 0 0;
  border-radius: inherit;
  color: var(--kt-on);
  cursor: pointer;
}

/* Keep the rounded focus ring without clipping edge glyphs. */
.kt-popup-language .kt-popup-language-select .MuiSelect-select { overflow: visible; }
.kt-popup-language-select .MuiSelect-select.MuiInputBase-input:focus {
  outline: 2px solid var(--kt-pri);
  outline-offset: 2px;
  background: transparent;
}
@supports selector(:focus-visible) {
  .kt-popup-language-select .MuiSelect-select.MuiInputBase-input:focus { outline: none; }
  .kt-popup-language-select .MuiSelect-select.MuiInputBase-input:focus-visible {
    outline: 2px solid var(--kt-pri);
    outline-offset: 2px;
  }
}

.kt-popup-language-value {
  min-width: 0;
  display: flex;
  align-items: center;
  line-height: 1.35;
}
.kt-popup-language-value__primary {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-popup-language-select .MuiSelect-icon {
  right: 0;
  color: var(--kt-onv);
}

.kt-popup-language-menu.MuiPaper-root {
  max-height: min(280px, calc(100% - 32px));
  margin-top: 6px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-surface, 12px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  box-shadow: var(--kt-shadow-menu);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.kt-popup-language-menu .MuiMenu-list { padding: 4px; }
.kt-popup-language-menu .MuiMenuItem-root {
  min-height: 36px;
  padding: 6px 10px;
  border-radius: var(--kt-radius-sm, 6px);
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  white-space: normal;
  overflow-wrap: anywhere;
}
.kt-popup-language-menu .MuiMenuItem-root.Mui-selected {
  background: var(--kt-pric);
  color: var(--kt-onpric);
  font-weight: 600;
}
@media (hover: hover) {
  .kt-popup-language-menu .MuiMenuItem-root:hover { background: var(--kt-sf1); }
  .kt-popup-language-menu .MuiMenuItem-root.Mui-selected:hover { background: var(--kt-pric); }
}

.kt-popup-swap.MuiIconButton-root {
  width: 36px;
  height: 36px;
  justify-self: center;
}
.kt-popup-swap.MuiIconButton-root.Mui-disabled {
  color: var(--kt-line);
  cursor: not-allowed;
  opacity: 0.65;
}

.kt-popup-section-label {
  margin: 0 0 6px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.35;
}

.kt-popup-services {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  overflow: visible;
}
.kt-popup-services--open { flex-wrap: wrap; }

.kt-popup-service {
  min-width: 0;
  min-height: 34px;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 6px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  cursor: pointer;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-popup-service:hover {
    background: var(--kt-sf1);
    border-color: var(--kt-line);
  }
}
.kt-popup-service[aria-pressed="true"] {
  border-color: var(--kt-pri);
  background: var(--kt-pric);
  color: var(--kt-onpric);
}
.kt-popup-service__name {
  min-width: 0;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kt-service-logo {
  width: 22px;
  height: 22px;
  display: grid;
  flex: none;
  place-items: center;
  border: 1px solid var(--kt-linev);
  border-radius: 50%;
  background: var(--kt-sf1);
}
.kt-m3-root[data-theme="dark"] .kt-service-logo {
  background: var(--kt-sf2);
}
.kt-service-logo img { width: 14px; height: 14px; object-fit: contain; }

.kt-popup-more-service {
  min-width: max-content;
  flex: 0 0 auto;
  padding-inline: 10px;
  border-color: transparent;
  background: var(--kt-sf2);
  color: var(--kt-onv);
}
.kt-popup-services--open .kt-popup-service { flex: 0 1 auto; }
.kt-popup-more-service svg { width: 18px; height: 18px; }
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-more-service svg {
    transition: transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-popup-more-service[aria-expanded="true"] svg { transform: rotate(180deg); }

.kt-popup-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 2px 10px;
  min-height: 36px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
}
.kt-popup-model-label {
  flex: none;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  color: var(--kt-onv);
}
.kt-popup-model-select {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  height: 30px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--kt-radius-sm, 6px);
  background: transparent;
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  cursor: pointer;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.kt-popup-site {
  padding: 10px 0;
  border-top: 1px solid var(--kt-linev);
  border-bottom: 1px solid var(--kt-linev);
  background: transparent;
}
.kt-popup-site__top {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.kt-popup-site__select {
  min-width: 0;
  min-height: 32px;
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
}
.kt-popup-site__status {
  flex: none;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}
.kt-popup-site__status--blocked {
  color: var(--kt-err);
}
.kt-popup-site__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin-top: 8px;
}
.kt-popup-site__actions--single { grid-template-columns: minmax(0, 1fr); }
.kt-popup-site__actions .MuiButton-root {
  min-width: 0;
  min-height: 34px;
  padding: 5px 10px;
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
}
.kt-popup-blacklist {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.kt-popup-blacklist li { display: flex; align-items: center; gap: 8px; }
.kt-popup-blacklist__entry {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  font-size: var(--kt-text-sm, 0.8125rem);
}
.kt-popup-blacklist .MuiButton-root {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 4px 10px;
  font-size: var(--kt-text-sm, 0.8125rem);
}

.kt-popup-site-policy {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-popup-site-policy__error {
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: var(--kt-radius-sm, 6px);
  background: var(--kt-errc);
  color: var(--kt-onerrc);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  line-height: 1.45;
}

/* Connected 10px segmented control for Follow / Auto / Off policy. */
.kt-popup-policy-modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding: 3px;
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf2);
}
.kt-popup-policy-mode {
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--kt-onv);
  cursor: pointer;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out), box-shadow var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-popup-policy-mode:hover {
    background: var(--kt-sf1);
    color: var(--kt-on);
  }
}
.kt-popup-policy-mode--active,
.kt-popup-policy-mode[aria-pressed="true"] {
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-weight: 600;
  box-shadow: var(--kt-shadow-card);
}
@media (hover: hover) {
  .kt-popup-policy-mode--active:hover,
  .kt-popup-policy-mode[aria-pressed="true"]:hover {
    background: var(--kt-sf0);
  }
}
@media (forced-colors: active) {
  .kt-popup-policy-mode--active,
  .kt-popup-policy-mode[aria-pressed="true"] {
    border: 1px solid Highlight;
  }
}

.kt-popup-quick-toggles {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--kt-linev);
}
.kt-popup-quick-toggles__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.kt-popup-quick-toggles__head .kt-popup-section-label {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kt-popup-quick-toggles__site-btn.MuiButton-root {
  flex: none;
  min-height: 28px;
  padding: 2px 8px;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  border-radius: var(--kt-radius-sm, 6px);
}
.kt-popup-quick-toggles__list {
  display: flex;
  flex-direction: column;
}
.kt-popup-toggle-row {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px;
  cursor: pointer;
}
.kt-popup-toggle-row__label {
  min-width: 0;
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  color: var(--kt-on);
  line-height: 1.35;
}
.kt-popup-toggle-row__meta {
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 500;
}

.kt-popup-disclosure-row { display: flex; align-items: center; }
.kt-popup-disclosure {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  border: 0;
  border-radius: var(--kt-radius-sm, 6px);
  background: transparent;
  color: var(--kt-onv);
  cursor: pointer;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  transition: color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-popup-disclosure:hover { color: var(--kt-on); }
}
.kt-popup-disclosure::after {
  content: "";
  height: 1px;
  flex: 1;
  order: -1;
  background: var(--kt-linev);
}
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-disclosure svg {
    transition: transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-popup-disclosure[aria-expanded="true"] svg { transform: rotate(180deg); }

.kt-popup-advanced {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-advanced {
    animation: kt-m3-rise var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-popup-advanced[hidden] { display: none; }

.kt-popup-advanced-tools { display: flex; gap: 8px; }
.kt-popup-advanced-tools .MuiButton-root {
  flex: 1;
  min-width: 0;
  min-height: 36px;
  padding: 6px 10px;
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
}
.kt-popup-advanced-tools .MuiButton-startIcon { flex: none; }
.kt-popup-advanced-tools .MuiButton-root:last-child { color: var(--kt-onv); }

.kt-popup-style-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.kt-popup-style-chip {
  min-width: 0;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  padding: 6px 10px;
  border: 1px solid var(--kt-linev);
  border-radius: var(--kt-radius-control, 10px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  cursor: pointer;
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  overflow-wrap: anywhere;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), border-color var(--kt-dur, 150ms) var(--kt-ease, ease-out), color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-popup-style-chip:hover {
    background: var(--kt-sf1);
    border-color: var(--kt-line);
  }
}
.kt-popup-style-chip[aria-pressed="true"] {
  border-color: var(--kt-pri);
  background: var(--kt-pric);
  color: var(--kt-onpric);
}
.kt-popup-style-chip > span {
  max-width: 100%;
  font-size: var(--kt-text-body, 0.875rem);
  line-height: 1.35;
}
.kt-popup-style-chip > small {
  max-width: 100%;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
  line-height: 1.3;
}
.kt-popup-style-chip[aria-pressed="true"] > small { color: inherit; }

.kt-popup-style-more {
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border-color: transparent;
  background: var(--kt-sf2);
  color: var(--kt-pri);
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
@media (hover: hover) {
  .kt-popup-style-more:hover { background: var(--kt-sf3); border-color: transparent; }
}
.kt-popup-style-more svg { width: 18px; height: 18px; flex: none; }
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-style-more svg {
    transition: transform var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-popup-style-more[aria-expanded="true"] svg { transform: rotate(180deg); }

.kt-popup-advanced-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}
.kt-popup-advanced-row {
  min-width: 0;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px;
  border-bottom: 1px solid var(--kt-linev);
  background: transparent;
  color: var(--kt-on);
  font-size: var(--kt-text-body, 0.875rem);
  font-weight: 500;
  transition: background-color var(--kt-dur, 150ms) var(--kt-ease, ease-out);
}
@media (hover: hover) {
  .kt-popup-advanced-row:hover { background: var(--kt-sf1); }
}

.kt-popup-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
  color: var(--kt-onv);
  font-size: var(--kt-text-sm, 0.8125rem);
}
.kt-popup-footer__keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}
.kt-popup-footer kbd {
  min-width: 24px;
  padding: 2px 6px;
  border: 1px solid var(--kt-line);
  border-bottom-width: 2px;
  border-radius: var(--kt-radius-sm, 6px);
  background: var(--kt-sf0);
  color: var(--kt-on);
  font-family: var(--kt-font-sans);
  font-variant-numeric: tabular-nums;
  font-size: var(--kt-text-sm, 0.8125rem);
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}
.kt-popup-footer__spacer { flex: 1; }
.kt-popup-footer .MuiButton-root {
  min-height: 32px;
  padding-inline: 10px;
  font-size: var(--kt-text-sm, 0.8125rem);
}

.kt-popup-text-panel { padding: 0; }
@media (prefers-reduced-motion: no-preference) {
  .kt-popup-text-panel {
    animation: kt-m3-rise var(--kt-dur, 150ms) var(--kt-ease, ease-out);
  }
}
.kt-popup-shell--window .kt-popup-text-panel { padding: 0; animation: none; }

.kt-popup-empty {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: var(--kt-onv);
  font-size: var(--kt-text-body, 0.875rem);
  line-height: 1.5;
  text-align: center;
}
.kt-popup-empty__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

@media (max-width: 395px) {
  .kt-popup-header { padding-inline: 14px; }
  .kt-popup-content { padding-inline: 14px; }
  .kt-popup-tabs { margin-inline: 14px; }
}
`;
