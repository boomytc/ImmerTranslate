import { browser } from "./browser";
import { isInBlacklist, matchingBlacklistEntries } from "./blacklist";
import {
  applyParentRuntime,
  installFrameRuntimeBridge,
  queryParentFrameRuntime,
} from "./iframe";
import { logger } from "./log";
import { getPopupDocumentIdentity } from "./popupDocument";
import { readRedditEmbeddingHref } from "./redditFrame";
import { matchRule as matchRuleDefault } from "./rules";
import { getStorageState } from "./storageState";
import TranslatorManager from "./translatorManager";
import { MSG_TRANS_GETRULE, STOKEY_RULES, STOKEY_SETTING } from "../config";

export function watchPageLocation(onChange) {
  if (typeof window === "undefined" || !window.history) return () => {};
  const { pushState, replaceState } = window.history;
  const notify = () => onChange(window.location.href);
  window.history.pushState = function pushStateAndNotify(...args) {
    const result = pushState.apply(this, args);
    notify();
    return result;
  };
  window.history.replaceState = function replaceStateAndNotify(...args) {
    const result = replaceState.apply(this, args);
    notify();
    return result;
  };
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  return () => {
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
  };
}

export function withFeatureBlacklists(setting, href) {
  const next = {
    ...(setting || {}),
    tranboxSetting: { ...(setting?.tranboxSetting || {}) },
    inputRule: { ...(setting?.inputRule || {}) },
    mouseHoverSetting: { ...(setting?.mouseHoverSetting || {}) },
  };
  if (isInBlacklist(href, next.tranboxSetting.blacklist)) {
    next.tranboxSetting.transOpen = false;
  }
  if (isInBlacklist(href, next.inputRule.blacklist)) {
    next.inputRule.transOpen = false;
  }
  if (isInBlacklist(href, next.mouseHoverSetting.blacklist)) {
    next.mouseHoverSetting.useMouseHover = false;
  }
  return next;
}

export function parkedPageResponse({ rule, setting, href, isIframe = false }) {
  const identity = getPopupDocumentIdentity();
  return {
    rule: { ...(rule || {}), transOpen: "false" },
    setting,
    capabilities: {
      pageTranslation: true,
      selectionTranslation: false,
      hoverTranslation: false,
      inputTranslation: false,
      ruleEditor: !isIframe,
    },
    isTopFrame: !isIframe,
    blocked: true,
    blacklistEntries: matchingBlacklistEntries(setting?.blacklist, href),
    document: isIframe ? identity : { ...identity, frameId: 0 },
  };
}

function listenForParkedPage(handler, { isUserscript, isIframe }) {
  const stops = [];
  const onWindow = (event) => {
    const result = handler(event?.data);
    if (
      result !== undefined &&
      typeof event?.source?.postMessage === "function"
    ) {
      event.source.postMessage(result, "*");
    }
  };
  if (isUserscript || isIframe) {
    window.addEventListener("message", onWindow);
    stops.push(() => window.removeEventListener("message", onWindow));
  }
  const runtime = browser?.runtime?.onMessage;
  if (!isUserscript && typeof runtime?.addListener === "function") {
    const onRuntime = (message, _sender, sendResponse) => {
      const result = handler(message);
      if (result && typeof result.then === "function") {
        result.then(sendResponse, (error) =>
          sendResponse({ error: error?.message || String(error) })
        );
        return true;
      }
      if (result !== undefined) sendResponse(result);
      return true;
    };
    runtime.addListener(onRuntime);
    stops.push(() => runtime.removeListener?.(onRuntime));
  }
  stops.push(
    installFrameRuntimeBridge(() => ({ transOpen: false, fabVisible: false }))
  );
  return () => stops.forEach((stop) => stop());
}

function subscribeStorage(key, defaultValue, onData) {
  const state = getStorageState(key, defaultValue);
  return state.subscribe((snapshot) => {
    if (
      !snapshot ||
      snapshot.isLoading ||
      snapshot.isSaving ||
      snapshot.isRecovering
    ) {
      return;
    }
    if (!snapshot.data || typeof snapshot.data !== "object") return;
    onData(snapshot);
  });
}

export class PageRuntime {
  #started = false;
  #generation = 0;
  #queue = Promise.resolve();
  #href = "";
  #setting;
  #rule;
  #manager;
  #closeParked = null;
  #unwatch = () => {};
  #unsubscribeSetting = () => {};
  #unsubscribeRules = () => {};

  constructor(options = {}) {
    this.#setting = options.setting || {};
    this.#rule = options.rule || null;
    this.#manager = options.manager || null;
    this.#href = options.href || "";
    this.options = options;
  }

  get manager() {
    return this.#manager;
  }

  start() {
    if (this.#started) return this.whenIdle();
    this.#started = true;
    const options = this.options;
    this.#href = options.getHref ? options.getHref() : window.location.href;
    const blocked = matchingBlacklistEntries(
      this.#setting?.blacklist,
      this.#href
    ).length;
    const ready =
      blocked || !this.#manager
        ? this.requestReconcile("start")
        : Promise.resolve();
    const watch = options.watchLocation || watchPageLocation;
    this.#unwatch = watch(() => {
      void this.requestReconcile("location");
    });
    const subscribeSetting =
      options.subscribeSetting ||
      ((onData) => subscribeStorage(STOKEY_SETTING, this.#setting, onData));
    const subscribeRules =
      options.subscribeRules ||
      ((onData) => subscribeStorage(STOKEY_RULES, [], onData));
    this.#unsubscribeSetting = subscribeSetting((snapshot) => {
      if (!snapshot?.data || typeof snapshot.data !== "object") return;
      this.#setting = snapshot.data;
      void this.requestReconcile("setting");
    });
    this.#unsubscribeRules = subscribeRules(() => {
      void this.requestReconcile("rules");
    });
    return ready;
  }

  whenIdle() {
    return this.#queue;
  }

  stop() {
    this.#generation += 1;
    this.#unwatch();
    this.#unwatch = () => {};
    this.#unsubscribeSetting();
    this.#unsubscribeRules();
    this.#unsubscribeSetting = () => {};
    this.#unsubscribeRules = () => {};
    this.#closeParked?.();
    this.#closeParked = null;
    this.#started = false;
  }

  requestReconcile(reason) {
    const generation = ++this.#generation;
    this.#queue = this.#queue
      .then(() => this.#reconcile(generation, reason))
      .catch((error) => {
        logger.info("page runtime", reason, error);
      });
    return this.#queue;
  }

  async #reconcile(generation) {
    if (generation !== this.#generation) return;
    const href = this.options.getHref
      ? this.options.getHref()
      : window.location.href;
    this.#href = href;
    if (matchingBlacklistEntries(this.#setting?.blacklist, href).length) {
      this.#park();
      return;
    }
    await this.#activate(generation);
  }

  #park() {
    if (this.#manager) {
      this.#manager.stop();
      this.#manager = null;
    }
    if (this.#closeParked) return;
    const listen = this.options.listen || listenForParkedPage;
    this.#closeParked = listen((message) => this.#onParkedMessage(message), {
      isUserscript: Boolean(this.options.isUserscript),
      isIframe: Boolean(this.options.isIframe),
    });
  }

  #onParkedMessage(message) {
    if (message?.action !== MSG_TRANS_GETRULE) return undefined;
    return parkedPageResponse({
      rule: this.#rule,
      setting: this.#setting,
      href: this.#href,
      isIframe: Boolean(this.options.isIframe),
    });
  }

  async #activate(generation) {
    this.#closeParked?.();
    this.#closeParked = null;
    const href = this.#href;
    const setting = withFeatureBlacklists(this.#setting, href);
    const ruleHref = this.options.ruleHref
      ? this.options.ruleHref(href, Boolean(this.options.isIframe))
      : readRedditEmbeddingHref(window, Boolean(this.options.isIframe)) || href;
    const match = this.options.matchRule || matchRuleDefault;
    let rule = await match(ruleHref, setting);
    if (generation !== this.#generation) return;
    if (this.options.isIframe) {
      const query = this.options.queryParent || queryParentFrameRuntime;
      const parent = await query();
      if (generation !== this.#generation) return;
      if (parent) rule = applyParentRuntime(rule, parent);
    }
    const favWords = this.options.getFavWords
      ? await this.options.getFavWords(rule)
      : this.options.favWords || [];
    if (generation !== this.#generation) return;
    this.#rule = rule;
    if (this.#manager) {
      this.#manager.applyLocationRule?.(rule);
      return;
    }
    const fabConfig = this.options.getFabConfig
      ? await this.options.getFabConfig()
      : this.options.fabConfig;
    if (generation !== this.#generation) return;
    const create =
      this.options.createManager || ((config) => new TranslatorManager(config));
    this.#manager = create({
      setting,
      rule,
      fabConfig,
      favWords,
      isIframe: Boolean(this.options.isIframe),
      isUserscript: Boolean(this.options.isUserscript),
      transboxOnly: Boolean(this.options.transboxOnly),
    });
    this.#manager.start();
    this.options.onActivate?.({ href, setting, rule });
  }
}

export function startPageRuntime(options) {
  const runtime = new PageRuntime(options);
  return runtime.start().then(() => runtime);
}
