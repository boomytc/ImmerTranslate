/**
 * First-run guide for the content script.
 * Classic script (not an ES module): content.js reads globalThis.ImmerOnboarding.
 *
 * Three skippable steps, in order: pin the toolbar icon, translate once from
 * the popup, then meet the floating ball. The card does not trap the page.
 * Finishing the last step, skipping the last step, or skipping the rest writes
 * `onboardingDone`. Reinstall or clearing that key shows the guide again.
 *
 * The existing one-time ball tip is a separate card. It stays hidden while this
 * guide is pending, visible, or was just dismissed on this document. Reaching
 * the ball step and then dismissing also sets `ballTipSeen`, so the tip does
 * not follow the guide. Skipping the rest before that step leaves the tip for
 * a later document, still once.
 */
(function initImmerOnboarding(root) {
  const STORAGE_KEY = "onboardingDone";

  const STEPS = [
    {
      id: "pin",
      title: "钉到工具栏",
      body: "点浏览器工具栏上的拼图图标，再点图钉，把 ImmerTranslate 固定出来。不钉的话，只能从扩展菜单里打开。",
    },
    {
      id: "popup",
      title: "点弹层译一页",
      body: "点工具栏图标打开弹层，再点「翻译」。这一页主内容会出现双语对照；再点一次则显示原文。",
    },
    {
      id: "ball",
      title: "认识悬浮球",
      body: "页面边缘的圆球和弹层是同一个开关。点一下可翻译或显示原文。拖到左右边缘后会贴边，并记住上下位置。",
    },
  ];

  function initialState() {
    return { index: 0, done: false, ballIntroduced: false };
  }

  /**
   * @param {number} index
   */
  function clampIndex(index) {
    const value = Number(index);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(STEPS.length - 1, Math.floor(value));
  }

  /**
   * @param {{ index?: number, done?: boolean, ballIntroduced?: boolean } | null | undefined} state
   * @param {"next" | "skip" | "skip-all"} action
   */
  function reduce(state, action) {
    const current = {
      index: clampIndex(state?.index),
      done: state?.done === true,
      ballIntroduced: state?.ballIntroduced === true,
    };
    if (current.done) return current;
    const last = current.index >= STEPS.length - 1;
    if (action === "skip-all" || ((action === "next" || action === "skip") && last)) {
      return {
        index: current.index,
        done: true,
        ballIntroduced: current.ballIntroduced || last,
      };
    }
    if (action === "next" || action === "skip") {
      const index = current.index + 1;
      return {
        index,
        done: false,
        ballIntroduced: current.ballIntroduced || index >= STEPS.length - 1,
      };
    }
    return current;
  }

  /**
   * @param {{ done?: boolean, ballIntroduced?: boolean } | null | undefined} state
   * @returns {{ onboardingDone: true, ballTipSeen?: true } | null}
   */
  function storagePatch(state) {
    if (state?.done !== true) return null;
    /** @type {{ onboardingDone: true, ballTipSeen?: true }} */
    const patch = { onboardingDone: true };
    if (state.ballIntroduced === true) patch.ballTipSeen = true;
    return patch;
  }

  /**
   * The guide is pending until the permanent flag is exactly true.
   * @param {unknown} stored
   */
  function guidePending(stored) {
    return stored !== true;
  }

  /**
   * @param {number} index
   */
  function primaryLabel(index) {
    return clampIndex(index) >= STEPS.length - 1 ? "完成" : "下一步";
  }

  /**
   * @param {number} index
   */
  function showSkipAll(index) {
    return clampIndex(index) < STEPS.length - 1;
  }

  /**
   * Ball tip stays one-shot and does not stack on this guide.
   * @param {{
   *   ballTipSeen?: boolean,
   *   guideVisible?: boolean,
   *   dismissedOnThisDocument?: boolean,
   *   guidePending?: boolean,
   * } | null | undefined} ctx
   */
  function allowBallTip(ctx) {
    if (!ctx || ctx.ballTipSeen === true) return false;
    if (ctx.guideVisible || ctx.dismissedOnThisDocument || ctx.guidePending) return false;
    return true;
  }

  root.ImmerOnboarding = {
    STORAGE_KEY,
    STEPS,
    initialState,
    reduce,
    storagePatch,
    guidePending,
    primaryLabel,
    showSkipAll,
    allowBallTip,
  };
})(globalThis);
