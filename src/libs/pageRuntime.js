import {
  MSG_INSTALL_LOCATION_HOOK,
  MSG_TRANS_GETRULE,
  STOKEY_RULES,
  STOKEY_SETTING,
} from "../config";
import { browser } from "./browser";
import { matchingBlacklistEntries } from "./blacklist";
import { withFeatureBlacklists } from "./featureBlacklists";
import { isExt, isGm } from "./client";
import {
  applyParentRuntime,
  installFrameRuntimeBridge,
  queryParentFrameRuntime,
} from "./iframe";
import { LOCATION_CHANGE_EVENT, installLocationHook } from "./locationHook";
import { logger } from "./log";
import { acceptsFrameMessage, sendBgMsg } from "./msg";
import { getPopupDocumentIdentity } from "./popupDocument";
import { readRedditEmbeddingHref } from "./redditFrame";
import { matchRule as matchRuleDefault } from "./rules";
import { ruleApplication, settingApplication } from "./runtimeUpdate";
import { isSameStorageValue } from "./storageEquality";
import { getStorageState } from "./storageState";
import TranslatorManager from "./translatorManager";

export function ensureLocationHook() {
  if (isGm) {
    installLocationHook(
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window
    );
    return;
  }
  if (!isExt) return;
  void Promise.resolve(sendBgMsg(MSG_INSTALL_LOCATION_HOOK)).catch((error) => {
    logger.info("location hook", error);
  });
}

export function watchPageLocation(onChange) {
  if (typeof window === "undefined") return () => {};
  const notify = () => onChange(window.location.href);
  const targets = new Set([window]);
  if (typeof unsafeWindow !== "undefined") targets.add(unsafeWindow);
  targets.forEach((target) => {
    target.addEventListener(LOCATION_CHANGE_EVENT, notify);
  });
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  return () => {
    targets.forEach((target) => {
      target.removeEventListener(LOCATION_CHANGE_EVENT, notify);
    });
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
  };
}

export { withFeatureBlacklists } from "./featureBlacklists";

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
      if (result === undefined) return;
      if (result && typeof result.then === "function") {
        result.then(sendResponse, (error) =>
          sendResponse({ error: error?.message || String(error) })
        );
        return true;
      }
      sendResponse(result);
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
  #appliedSetting;
  #manager;
  // The live switch captured when this document was parked. It applies only
  // when the same URL leaves the blacklist; a later URL uses its own rule.
  #pausedTransOpen;
  #closeParked = null;
  #unwatch = () => {};
  #unsubscribeSetting = () => {};
  #unsubscribeRules = () => {};

  constructor(options = {}) {
    this.#setting = options.setting || {};
    this.#appliedSetting = this.#setting;
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
    // 已有管理器时，基线是当前网址折出来的那份，不是被改过的存储对象。
    if (this.#manager && !blocked) {
      this.#appliedSetting = withFeatureBlacklists(this.#setting, this.#href);
    }
    const ready =
      blocked || !this.#manager ? this.requestReconcile() : Promise.resolve();
    ensureLocationHook();
    const watch = options.watchLocation || watchPageLocation;
    this.#unwatch = watch(() => {
      void this.requestReconcile();
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
      void this.requestReconcile();
    });
    this.#unsubscribeRules = subscribeRules(() => {
      void this.requestReconcile();
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

  requestReconcile() {
    const generation = ++this.#generation;
    this.#queue = this.#queue
      .then(() => this.#reconcile(generation))
      .catch((error) => {
        logger.info("page runtime", error);
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
      // stop() clears the translator, and Translator.stop() forces transOpen
      // to false. Read the live switch first.
      const live = this.#manager.readLiveTransOpen?.();
      if ((live === "true" || live === "false") && this.#href) {
        this.#pausedTransOpen = { href: this.#href, transOpen: live };
      }
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
    if (
      !acceptsFrameMessage(message, {
        isIframe: Boolean(this.options.isIframe),
      })
    ) {
      return undefined;
    }
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
    const previousTransOpen = this.#rule?.transOpen;
    const previousSetting = this.#appliedSetting;
    this.#rule = rule;
    const settingChanged = !isSameStorageValue(previousSetting, setting);
    this.#appliedSetting = setting;
    if (this.#manager) {
      this.#pausedTransOpen = undefined;
      this.#manager.applyLocationRule?.(
        ruleApplication({
          previousTransOpen,
          rule,
          setting: settingChanged
            ? settingApplication({ previous: previousSetting, setting })
            : null,
        })
      );
      return;
    }
    const fabConfig = this.options.getFabConfig
      ? await this.options.getFabConfig()
      : this.options.fabConfig;
    if (generation !== this.#generation) return;
    const paused = this.#pausedTransOpen;
    this.#pausedTransOpen = undefined;
    const startRule =
      paused?.href === href ? { ...rule, transOpen: paused.transOpen } : rule;
    const create =
      this.options.createManager || ((config) => new TranslatorManager(config));
    this.#manager = create({
      setting,
      rule: startRule,
      fabConfig,
      favWords,
      isIframe: Boolean(this.options.isIframe),
      isUserscript: Boolean(this.options.isUserscript),
      transboxOnly: Boolean(this.options.transboxOnly),
    });
    this.#manager.start();
    // A page that was blocked at load only had { transOpen: "false" } to give
    // the popup. Publish the matched rule once the manager exists.
    this.#manager.publishRuntimeRule?.();
    this.options.onActivate?.({ href, setting, rule: startRule });
  }
}

export function startPageRuntime(options) {
  const runtime = new PageRuntime(options);
  return runtime.start().then(() => runtime);
}
