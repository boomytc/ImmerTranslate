/**
 * XMLHttpRequest 拦截注入器
 * 主要用于重写原生的 XMLHttpRequest.prototype.open，拦截页面中的特定请求（例如 YouTube 的 `timedtext` 歌词/字幕接口）。
 * 拦截成功后，它会监听加载事件，并通过安全信道将字幕原始响应文本派发给上层 Content Script，以实现视频/音频双语字幕渲染。
 */
export const XMLHttpRequestInjector = () => {
  try {
    const hookFlag = "__IMMERTRANSLATE_XHR_HOOKED__";
    if (window[hookFlag]) {
      return;
    }
    window[hookFlag] = true;

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      const url = args[1];
      // 匹配 YouTube 的 timedtext 字幕网络请求链接
      if (typeof url === "string" && url.includes("timedtext")) {
        this.addEventListener(
          "load",
          function () {
            try {
              if (this.responseType !== "" && this.responseType !== "text") {
                return;
              }
              const response = this.responseText;
              if (!response) {
                return;
              }
              // 向主应用派发字幕数据，使用了安全的原点限制 (window.location.origin)
              window.postMessage(
                {
                  // 函数源码会进入页面，这个字符串必须与 MSG_XHR_DATA_YOUTUBE 一致。
                  type: "IMMERTRANSLATE_XHR_DATA_YOUTUBE",
                  url: this.responseURL,
                  response,
                },
                window.location.origin
              );
            } catch (loadErr) {
              // 忽略非文本或异常状态的响应读取错误，避免影响页面原请求。
            }
          },
          { once: true }
        );
      }
      return originalOpen.apply(this, args);
    };
  } catch (err) {
    console.log("XMLHttpRequestInjector", err);
  }
};
