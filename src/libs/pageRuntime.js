import {
  MSG_INSTALL_LOCATION_HOOK,
  STOKEY_RULES,
  STOKEY_SETTING,
} from "../config";
import { matchingBlacklistEntries } from "./blacklist";
import { isExt } from "./client";
import { withFeatureBlacklists } from "./featureBlacklists";
import { applyParentRuntime, queryParentFrameRuntime } from "./iframe";
import { LOCATION_CHANGE_EVENT } from "./locationHook";
import { logger } from "./log";
import { sendBgMsg } from "./msg";
import { readRedditEmbeddingHref } from "./redditFrame";
import { matchRule as matchRuleDefault } from "./rules";
import { ManualOverride, pageTarget } from "./pageSwitch";
import { SITE_TRANS_OPEN } from "./siteTransOpen";
import { getStorageState } from "./storageState";
import { readSiteTransOpen } from "../views/Action/sitePolicy";
import TranslatorManager from "./translatorManager";

export function ensureLocationHook() {
  if (!isExt) return;
  void Promise.resolve(sendBgMsg(MSG_INSTALL_LOCATION_HOOK)).catch((error) => {
    logger.info("location hook", error);
  });
}

export function watchPageLocation(onChange) {
  if (typeof window === "undefined") return () => {};
  const notify = () => onChange(window.location.href);
  window.addEventListener(LOCATION_CHANGE_EVENT, notify);
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  return () => {
    window.removeEventListener(LOCATION_CHANGE_EVENT, notify);
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
  };
}

export { withFeatureBlacklists } from "./featureBlacklists";

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

/** 全局规则缺 transOpen，或值不是 `"true"`，读侧都当成 `"false"`。 */
function globalTransOpenOf(rules) {
  const value = (rules || []).find(
    (rule) => rule?.pattern === SITE_TRANS_OPEN.FOLLOW_GLOBAL
  )?.transOpen;
  return value === SITE_TRANS_OPEN.AUTO_TRANSLATE
    ? SITE_TRANS_OPEN.AUTO_TRANSLATE
    : SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE;
}

export class PageRuntime {
  #started = false;
  #generation = 0;
  #queue = Promise.resolve();
  #href = "";
  #setting;
  #rules = null;
  #rule;
  #manager;
  #override = null;
  #context = null;
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
    this.#bindManualSwitch(this.#manager);
    if (this.#manager) {
      const policy =
        this.#rule?.transOpen || SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE;
      this.#context = {
        rule: {
          ...(this.#rule || {}),
          transOpen: policy,
        },
        policy,
        href: this.#href,
        blacklistHit: Boolean(
          matchingBlacklistEntries(this.#setting?.blacklist, this.#href).length
        ),
        globalTransOpen: SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE,
        setting: withFeatureBlacklists(this.#setting, this.#href),
        favWords: options.favWords || [],
      };
    }
    const blocked = matchingBlacklistEntries(
      this.#setting?.blacklist,
      this.#href
    ).length;
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
    this.#unsubscribeRules = subscribeRules((snapshot) => {
      if (!Array.isArray(snapshot?.data)) return;
      this.#rules = snapshot.data;
      void this.requestReconcile();
    });
    return ready;
  }

  whenIdle() {
    return this.#queue;
  }

  /** 本页手动开关。黑名单期间也记下，离开后仍按记录时的策略决定是否生效。 */
  setManualSwitch(enabled) {
    if (!this.#context) return;
    this.#override = new ManualOverride(
      this.#context.href,
      this.#context.policy,
      enabled ? "on" : "off"
    );
    this.#apply(this.#context);
  }

  stop() {
    this.#generation += 1;
    this.#unwatch();
    this.#unwatch = () => {};
    this.#unsubscribeSetting();
    this.#unsubscribeRules();
    this.#unsubscribeSetting = () => {};
    this.#unsubscribeRules = () => {};
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
    const blacklistHit = Boolean(
      matchingBlacklistEntries(this.#setting?.blacklist, href).length
    );
    const setting = withFeatureBlacklists(this.#setting, href);
    const ruleHref = this.options.ruleHref
      ? this.options.ruleHref(href, Boolean(this.options.isIframe))
      : readRedditEmbeddingHref(window, Boolean(this.options.isIframe)) || href;
    const match = this.options.matchRule || matchRuleDefault;
    let rule = await match(ruleHref, setting);
    if (generation !== this.#generation) return;
    let policy = this.#rules
      ? readSiteTransOpen(href, this.#rules)
      : rule?.transOpen;
    if (this.options.isIframe) {
      const query = this.options.queryParent || queryParentFrameRuntime;
      const parent = await query();
      if (generation !== this.#generation) return;
      if (parent) {
        rule = applyParentRuntime(rule, parent);
        policy = rule?.transOpen;
      }
    }
    const favWords = this.options.getFavWords
      ? await this.options.getFavWords(rule)
      : this.options.favWords || [];
    if (generation !== this.#generation) return;
    const context = {
      rule: { ...(rule || {}), transOpen: policy },
      policy,
      href,
      blacklistHit,
      globalTransOpen: globalTransOpenOf(this.#rules),
      setting,
      favWords,
    };
    this.#rule = context.rule;
    this.#apply(context);
  }

  #apply(context) {
    this.#context = context;
    const target = pageTarget({ ...context, override: this.#override });
    if (!this.#manager) {
      const create =
        this.options.createManager ||
        ((config) => new TranslatorManager(config));
      this.#manager = create({
        setting: target.setting,
        rule: target.rule,
        fabConfig: this.options.fabConfig,
        favWords: context.favWords,
        isIframe: Boolean(this.options.isIframe),
        isUserscript: Boolean(this.options.isUserscript),
        transboxOnly: Boolean(this.options.transboxOnly),
        onManualSwitch: (enabled) => this.setManualSwitch(enabled),
      });
      this.#bindManualSwitch(this.#manager);
      this.#manager.start();
      this.options.onActivate?.({
        href: context.href,
        setting: target.setting,
        rule: target.rule,
      });
    } else {
      this.#manager.applyTarget?.(target);
    }
    if (target.state === "paused") this.#manager.pause?.();
    else this.#manager.resume?.();
  }

  #bindManualSwitch(manager) {
    manager?.setManualSwitchHandler?.((enabled) =>
      this.setManualSwitch(enabled)
    );
  }
}

export function startPageRuntime(options) {
  const runtime = new PageRuntime(options);
  return runtime.start().then(() => runtime);
}
