import React from "react";
import ReactDOM from "react-dom/client";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { logger } from "./log";

/**
 * 普通 DOM 管理器，用于管理 React 组件的挂载、更新和销毁
 * 与 ShadowDomManager 不同，此管理器直接将组件挂载到普通 DOM 节点，不使用 Shadow DOM
 * 这样可以让组件直接访问外部数据，无需通过事件通信
 */
export default class DomManager {
  #hostElement = null;
  #reactRoot = null;
  #emotionCache = null;
  #boundHide = null;
  #isVisible = false;
  #isProcessing = false;

  _id;
  _className;
  _ReactComponent;
  _props;
  _rootElement;

  constructor({
    id,
    className = "",
    reactComponent,
    props = {},
    rootElement = document.body,
  }) {
    if (!id || !reactComponent) {
      throw new Error("ID and a React Component must be provided.");
    }
    this._id = id;
    this._className = className;
    this._ReactComponent = reactComponent;
    this._props = props;
    this._rootElement = rootElement;
    this.#boundHide = this.hide.bind(this);
  }

  get isVisible() {
    return this.#isVisible;
  }

  /**
   * 显示组件
   * @param {Object} props - 可选的新 props，如果不提供则使用构造函数中的 props
   */
  show(props) {
    if (this.#isVisible || this.#isProcessing) {
      return;
    }

    if (!this.#hostElement) {
      this.#isProcessing = true;
      try {
        this.#mount(props || this._props);
      } catch (error) {
        logger.warn(`Failed to mount component with id "${this._id}":`, error);
        this.#isProcessing = false;
        return;
      } finally {
        this.#isProcessing = false;
      }
    } else if (props) {
      this.updateProps(props);
    }

    this.#hostElement.style.display = "";
    this.#isVisible = true;
  }

  /**
   * 隐藏组件（不销毁）
   */
  hide() {
    if (!this.#isVisible || !this.#hostElement) {
      return;
    }
    this.#hostElement.style.display = "none";
    this.#isVisible = false;
  }

  /**
   * 销毁组件并移除 DOM 节点
   */
  destroy() {
    if (!this.#hostElement) {
      return;
    }
    this.#isProcessing = true;

    if (this.#reactRoot) {
      this.#reactRoot.unmount();
    }

    this.#hostElement.remove();

    this.#hostElement = null;
    this.#reactRoot = null;
    this.#emotionCache = null;
    this.#isVisible = false;
    this.#isProcessing = false;
    logger.info(`Component with id "${this._id}" has been destroyed.`);
  }

  /**
   * 切换组件显示/隐藏状态
   * @param {Object} props - 可选的新 props
   */
  toggle(props) {
    if (this.#isVisible) {
      this.hide();
    } else {
      this.show(props || this._props);
    }
  }

  /**
   * 更新组件 props（同步更新实例记录，已挂载时复用已有 Emotion cache 并保留 onClose）
   * @param {Object} newProps - 新的 props
   */
  updateProps(newProps) {
    this._props = newProps;
    if (this.#reactRoot && this.#hostElement) {
      const ComponentToRender = this._ReactComponent;
      if (!this.#emotionCache) {
        this.#emotionCache = createCache({
          key: this._id,
          prepend: true,
        });
      }
      const enhancedProps = {
        ...(this._props || {}),
        onClose: this.#boundHide,
      };
      this.#reactRoot.render(
        <React.StrictMode>
          <CacheProvider value={this.#emotionCache}>
            <ComponentToRender {...enhancedProps} />
          </CacheProvider>
        </React.StrictMode>
      );
    }
  }

  /**
   * 挂载组件到 DOM
   * @private
   */
  #mount(props) {
    this._props = props;
    const host = document.createElement("div");
    host.id = this._id;
    if (this._className) {
      host.className = this._className;
    }

    this._rootElement.appendChild(host);
    this.#hostElement = host;

    this.#emotionCache = createCache({
      key: this._id,
      prepend: true,
    });

    const enhancedProps = {
      ...(props || {}),
      onClose: this.#boundHide,
    };

    const ComponentToRender = this._ReactComponent;
    this.#reactRoot = ReactDOM.createRoot(host);
    this.#reactRoot.render(
      <React.StrictMode>
        <CacheProvider value={this.#emotionCache}>
          <ComponentToRender {...enhancedProps} />
        </CacheProvider>
      </React.StrictMode>
    );
  }
}
