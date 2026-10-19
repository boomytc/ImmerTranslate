import { APP_NAME } from "./config/app";
import { getFabWithDefault, getSettingWithDefault } from "./libs/storage";
import { isIframe } from "./libs/iframe";
import { startPageRuntime } from "./libs/pageRuntime";
import { runSubtitle } from "./subtitle/subtitle";
import { logger } from "./libs/log";
import { normalizeFabConfig } from "./config/fab";

/**
 * 在页面顶部弹出一个悬浮的红色错误提示 Banner 框，持续 10 秒后自动淡出。
 * @param {string} message 错误内容信息
 */
function showErr(message) {
  const bannerId = `${APP_NAME}-message`;
  const existingBanner = document.getElementById(bannerId);
  if (existingBanner) {
    existingBanner.remove();
  }

  const banner = document.createElement("div");
  banner.id = bannerId;

  // 设置 Banner 绝对定位和高 z-index，保证提示在前台可见
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    backgroundColor: "#f44336",
    color: "white",
    textAlign: "center",
    padding: "8px 16px",
    zIndex: "1001",
    boxSizing: "border-box",
    fontSize: "16px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  });

  const closeButton = document.createElement("span");
  closeButton.textContent = "×";

  Object.assign(closeButton.style, {
    position: "absolute",
    top: "50%",
    right: "20px",
    transform: "translateY(-50%)",
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "bold",
  });

  const messageText = document.createTextNode(`ImmerTranslate: ${message}`);
  banner.appendChild(messageText);
  banner.appendChild(closeButton);

  document.body.appendChild(banner);

  // 渐隐淡出效果
  const removeBanner = () => {
    banner.style.transition = "opacity 0.5s ease";
    banner.style.opacity = "0";
    setTimeout(() => {
      if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }, 500);
  };

  closeButton.onclick = removeBanner;
  setTimeout(removeBanner, 10000); // 10秒后自动消失
}

const IFRAME_TEXT_CHECK_TIMEOUT = 1000;
const IFRAME_TEXT_IGNORE_SELECTOR = [
  "script",
  "style",
  "template",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "input",
  "textarea",
  "select",
  "option",
  ".notranslate",
  "[translate='no']",
  "[contenteditable='true']",
].join(", ");

function waitForDocumentReady(timeout = IFRAME_TEXT_CHECK_TIMEOUT) {
  if (document.readyState !== "loading") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      document.removeEventListener("DOMContentLoaded", done);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    document.addEventListener("DOMContentLoaded", done, { once: true });
  });
}

function hasIframeTranslatableText() {
  if (!document.body) return false;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.parentElement?.closest(IFRAME_TEXT_IGNORE_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  return Boolean(walker.nextNode());
}

async function waitForIframeTranslatableText() {
  await waitForDocumentReady();
  return hasIframeTranslatableText();
}

/**
 * 前端翻译器的核心运行总入口。
 */
export async function run() {
  try {
    // 1. 加载本地设置
    const setting = await getSettingWithDefault();

    // 2. 初始化全局日志配置
    logger.setLevel(setting.logLevel);

    // 3. 页面类型拦截：若是 PDF / 图片 / 音视频等非 HTML 或纯文本媒体页面，则终止执行，避免注入多余 DOM
    const contentType = document?.contentType?.toLowerCase() || "";
    const isPdfDocument = contentType.includes("application/pdf");
    if (
      !contentType.includes("text") &&
      !contentType.includes("html") &&
      !isPdfDocument
    ) {
      logger.info("Skip running in document content type: ", contentType);
      return;
    }

    // 5.1. iframe 空内容拦截：默认允许 iframe 翻译，但空 iframe 不继续挂载后续脚本
    if (isIframe && !(await waitForIframeTranslatableText())) {
      return;
    }

    let sideEffectsStarted = false;
    const startSideEffects = ({
      href: pageHref,
      setting: pageSetting,
      rule: pageRule,
    }) => {
      if (sideEffectsStarted || isIframe || isPdfDocument) return;
      sideEffectsStarted = true;
      runSubtitle({
        href: pageHref,
        setting: pageSetting,
        rule: pageRule,
      });
    };

    const runtimeOptions = {
      setting,
      fabConfig: null,
      isIframe,
      transboxOnly: isPdfDocument,
      onActivate: startSideEffects,
    };

    // 管理器只在 PageRuntime 里构造，并在构造时传入真正的手动开关。
    runtimeOptions.fabConfig = normalizeFabConfig(await getFabWithDefault());
    await startPageRuntime(runtimeOptions);
  } catch (err) {
    console.error("[ImmerTranslate]", err);
    showErr(err.message); // 向前台页面绘制报错 Banner，便于用户感知与排查问题
  }
}
