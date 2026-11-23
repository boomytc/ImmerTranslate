/**
 * Shadow DOM 创建拦截器
 * 用于重写原生的 Element.prototype.attachShadow 方法，以便在页面上动态创建 Shadow Root 时，
 * 能够实时捕获并向扩展主线程发送通知，启动翻译节点的重新扫描与样式表挂载。
 */
export const shadowRootInjector = () => {
  try {
    const hookFlag = "__IMMERTRANSLATE_SHADOWROOT_HOOKED__";
    if (window[hookFlag]) {
      return;
    }
    window[hookFlag] = true;

    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (...args) {
      // 执行原生的 attachShadow 逻辑
      const root = orig.apply(this, args);

      // 函数源码会进入页面，这个字符串必须与 MSG_SHADOW_ROOT_CREATED 一致。
      try {
        if (window.location.origin && window.location.origin !== "null") {
          window.postMessage(
            { type: "IMMERTRANSLATE_SHADOW_ROOT_CREATED" },
            window.location.origin
          );
        }
      } catch (postErr) {
        // 忽略受限来源下的消息派发异常，避免影响页面创建 ShadowRoot。
      }
      return root;
    };
  } catch (err) {
    console.log("shadowRootInjector", err);
  }
};
