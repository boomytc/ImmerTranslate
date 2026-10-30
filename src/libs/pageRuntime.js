import {
  MSG_INSTALL_LOCATION_HOOK,
  DEFAULT_RULES,
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
import { deriveRuleContext } from "./rules";
import { normalizeStoredSetting } from "./storage";
import {
  ManualOverride,
  PAGE_SWITCH,
  pageSwitchState,
  pageTarget,
} from "./pageSwitch";
import { SITE_TRANS_OPEN, sitePolicy, sitePolicyValue } from "./siteTransOpen";
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
  const unsubscribe = state.subscribe(onData);
  unsubscribe.load = async () => {
    await state.ensureLoaded();
    if (state.snapshot.isRecovering) await state.load();
  };
  return unsubscribe;
}

export class PageRuntime {
  #started = false;
  #generation = 0;
  #lifecycle = 0;
  #queue = Promise.resolve();
  #startPromise = null;
  #cancelStart = null;
  #initializing = false;
  #initialReconcileStarted = false;
  #initialSnapshotsConfirmed = false;
  #initialError = null;
  #settingReady = false;
  #href = "";
  #setting;
  #rules = null;
  #manager;
  #override = null;
  #pagePatch = {};
  #context = null;
  #unwatch = () => {};
  #unsubscribeSetting = () => {};
  #unsubscribeRules = () => {};

  constructor(options = {}) {
    this.#setting = options.setting || {};
    this.#manager = options.manager || null;
    this.#href = options.href || "";
    this.options = options;
  }

  get manager() {
    return this.#manager;
  }

  start() {
    if (this.#started) return this.#startPromise || this.whenIdle();
    this.#started = true;
    this.#initializing = true;
    this.#initialReconcileStarted = false;
    this.#initialSnapshotsConfirmed = false;
    this.#initialError = null;
    this.#settingReady = false;
    this.#rules = null;
    this.#context = null;
    const lifecycle = ++this.#lifecycle;
    const options = this.options;
    const subscribeSetting =
      options.subscribeSetting ||
      ((onData) => subscribeStorage(STOKEY_SETTING, this.#setting, onData));
    const subscribeRules =
      options.subscribeRules ||
      ((onData) => subscribeStorage(STOKEY_RULES, DEFAULT_RULES, onData));
    const cancelled = new Promise((resolve) => {
      this.#cancelStart = () => resolve(false);
    });
    let settingConfirmed = false;
    let rulesConfirmed = false;
    let resumeConfirmed;
    let rejectInvalid;
    const invalid = new Promise((_, reject) => (rejectInvalid = reject));
    // Subscriptions can publish synchronously before the first race is installed.
    invalid.catch(() => {});
    const confirmed = () => settingConfirmed && rulesConfirmed;
    const waitForConfirmed = () =>
      confirmed()
        ? Promise.resolve(true)
        : new Promise((resolve) => (resumeConfirmed = resolve));
    const notifyConfirmed = () => {
      this.#initialSnapshotsConfirmed = confirmed();
      if (confirmed() && resumeConfirmed) {
        const resume = resumeConfirmed;
        resumeConfirmed = null;
        resume(true);
      }
    };
    const wait = (promise) => Promise.race([promise, cancelled, invalid]);
    const pending = (snapshot) =>
      !snapshot ||
      snapshot.isLoading ||
      snapshot.isSaving ||
      snapshot.isRecovering;
    const invalidate = () => {
      this.#initialSnapshotsConfirmed = false;
      if (this.#initializing && this.#initialReconcileStarted)
        this.#generation += 1;
    };
    const failInvalid = (error) => {
      if (this.#initializing) rejectInvalid(error);
      else logger.info("page runtime", error);
    };
    this.#startPromise = (async () => {
      try {
        const href = options.getHref ? options.getHref() : window.location.href;
        if (this.#href && this.#href !== href) {
          this.#pagePatch = {};
          this.#override = null;
        }
        this.#href = href;
        ensureLocationHook();
        const watch = options.watchLocation || watchPageLocation;
        this.#unwatch = watch(() => {
          void this.requestReconcile();
        });
        this.#unsubscribeSetting = subscribeSetting((snapshot) => {
          if (!this.#started || lifecycle !== this.#lifecycle) return;
          if (pending(snapshot)) {
            settingConfirmed = false;
            invalidate();
            return;
          }
          if (
            !snapshot.data ||
            typeof snapshot.data !== "object" ||
            Array.isArray(snapshot.data)
          ) {
            settingConfirmed = false;
            invalidate();
            failInvalid(new TypeError("Invalid settings snapshot"));
            return;
          }
          try {
            this.#setting = options.subscribeSetting
              ? snapshot.data
              : normalizeStoredSetting(snapshot.data);
          } catch (error) {
            settingConfirmed = false;
            invalidate();
            failInvalid(error);
            return;
          }
          this.#settingReady = true;
          settingConfirmed = true;
          notifyConfirmed();
          if (
            this.#rules &&
            (!this.#initializing ||
              (this.#initialReconcileStarted && confirmed()))
          ) {
            void this.requestReconcile();
          }
        });
        this.#unsubscribeRules = subscribeRules((snapshot) => {
          if (!this.#started || lifecycle !== this.#lifecycle) return;
          if (pending(snapshot)) {
            rulesConfirmed = false;
            invalidate();
            return;
          }
          if (!Array.isArray(snapshot.data)) {
            rulesConfirmed = false;
            invalidate();
            failInvalid(
              new TypeError("Invalid rules snapshot: expected an array")
            );
            return;
          }
          this.#rules = snapshot.data;
          rulesConfirmed = true;
          notifyConfirmed();
          if (
            this.#settingReady &&
            (!this.#initializing ||
              (this.#initialReconcileStarted && confirmed()))
          ) {
            void this.requestReconcile();
          }
        });
        // Both listeners must be present before either first read is requested.
        if (
          !(await wait(
            Promise.all([
              this.#unsubscribeSetting.load?.(),
              this.#unsubscribeRules.load?.(),
            ]).then(() => true)
          ))
        )
          return;
        while (this.#started && lifecycle === this.#lifecycle) {
          if (!(await wait(waitForConfirmed()))) return;
          if (!confirmed()) continue;
          this.#initialReconcileStarted = true;
          if (!(await wait(this.requestReconcile().then(() => true)))) return;
          while (this.#started && lifecycle === this.#lifecycle) {
            const queue = this.#queue;
            if (!(await wait(queue.then(() => true)))) return;
            if (queue === this.#queue) break;
          }
          if (confirmed()) break;
        }
        if (this.#initialError) throw this.#initialError;
        if (this.#started && lifecycle === this.#lifecycle) {
          this.#initializing = false;
          this.#startPromise = null;
          this.#cancelStart = null;
        }
      } catch (error) {
        if (this.#started && lifecycle === this.#lifecycle) {
          this.stop();
        }
        throw error;
      }
    })();
    return this.#startPromise;
  }

  whenIdle() {
    return this.#startPromise || this.#queue;
  }

  /** 本页手动开关。暂停中没有选择可记，调用直接结束。 */
  setManualSwitch(enabled) {
    const href = this.options.getHref
      ? this.options.getHref()
      : window.location.href;
    if (
      !this.#started ||
      !this.#context ||
      this.#context.blacklistHit ||
      href !== this.#context.href
    )
      return;
    const turningOn =
      enabled === true ||
      (enabled !== false &&
        pageSwitchState({
          ...this.#context,
          override: this.#override,
        }) !== PAGE_SWITCH.ON);
    this.#override = new ManualOverride(
      this.#context.href,
      sitePolicyValue(this.#context.policy),
      turningOn ? PAGE_SWITCH.ON : PAGE_SWITCH.OFF
    );
    this.#apply(this.#context);
  }

  stop() {
    this.#generation += 1;
    this.#lifecycle += 1;
    this.#cancelStart?.();
    this.#cancelStart = null;
    this.#unwatch();
    this.#unwatch = () => {};
    this.#unsubscribeSetting();
    this.#unsubscribeRules();
    this.#unsubscribeSetting = () => {};
    this.#unsubscribeRules = () => {};
    this.#started = false;
    this.#initializing = false;
    this.#startPromise = null;
    this.#queue = Promise.resolve();
    this.#manager?.stop?.();
    this.#manager = null;
    this.#context = null;
  }

  requestReconcile() {
    if (
      !this.#started ||
      !this.#settingReady ||
      !this.#rules ||
      (this.#initializing && !this.#initialSnapshotsConfirmed)
    )
      return this.#queue;
    const href = this.options.getHref
      ? this.options.getHref()
      : window.location.href;
    if (href !== this.#href) {
      this.#href = href;
      this.#pagePatch = {};
      this.#override = null;
    }
    const generation = ++this.#generation;
    this.#queue = this.#queue
      .then(() => this.#reconcile(generation))
      .catch((error) => {
        if (this.#initializing && generation === this.#generation) {
          this.#initialError = error;
        }
        logger.info("page runtime", error);
      });
    return this.#queue;
  }

  async #reconcile(generation) {
    if (!this.#started || generation !== this.#generation) return;
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
    const rules = this.#rules;
    const match =
      this.options.matchRule ||
      ((url, _setting, snapshot) =>
        deriveRuleContext(url, { personalRules: snapshot }).effective);
    let rule = await match(ruleHref, setting, rules);
    if (generation !== this.#generation) return;
    let policy = sitePolicy(readSiteTransOpen(href, rules));
    if (this.options.isIframe) {
      const query = this.options.queryParent || queryParentFrameRuntime;
      const parent = await query();
      if (generation !== this.#generation) return;
      if (parent) {
        rule = applyParentRuntime(rule, parent);
        // 子框架跟父页面当时的开关，不读折叠后的 matchRule.transOpen。
        policy = sitePolicy(
          parent.transOpen
            ? SITE_TRANS_OPEN.AUTO_TRANSLATE
            : SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE
        );
      }
    }
    const context = {
      rule: { ...(rule || {}) },
      policy,
      href,
      blacklistHit,
      globalTransOpen: rules.find(
        (rule) => rule?.pattern === SITE_TRANS_OPEN.FOLLOW_GLOBAL
      )?.transOpen,
      setting,
    };
    this.#apply(context);
  }

  #apply(context) {
    if (context.blacklistHit) this.#override = null;
    this.#context = context;
    const target = pageTarget({
      ...context,
      rule: { ...context.rule, ...this.#pagePatch },
      override: this.#override,
    });
    if (!this.#manager) {
      const create =
        this.options.createManager ||
        ((config) => new TranslatorManager(config));
      this.#manager = create({
        setting: target.setting,
        rule: target.rule,
        pageSwitch: target.state,
        fabConfig: this.options.fabConfig,
        isIframe: Boolean(this.options.isIframe),
        transboxOnly: Boolean(this.options.transboxOnly),
        onManualSwitch: (enabled) => this.setManualSwitch(enabled),
        onPageRuleChange: (patch) => {
          const href = this.options.getHref
            ? this.options.getHref()
            : window.location.href;
          if (
            !this.#started ||
            href !== this.#href ||
            href !== this.#context?.href
          )
            return;
          this.#pagePatch = { ...this.#pagePatch, ...patch };
        },
      });
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
}

export function startPageRuntime(options) {
  const runtime = new PageRuntime(options);
  return runtime.start().then(() => runtime);
}
