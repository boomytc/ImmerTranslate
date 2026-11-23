import Selection from "../views/Selection";
import {
  DEFAULT_TRANBOX_SETTING,
  APP_CONSTS,
  resolveApiPromptList,
} from "../config";
import ShadowDomManager from "./shadowDomManager";

function resolvePromptProps(props = {}) {
  return {
    ...props,
    transApis: resolveApiPromptList(
      props.transApis,
      props.prompts,
      props.subtitleSetting
    ),
  };
}

export class TransboxManager {
  #manager = null;
  #props = {};

  constructor(initialProps = {}) {
    this.#props = resolvePromptProps(initialProps);
    this.#manager = new ShadowDomManager({
      id: APP_CONSTS.boxID,
      className: "notranslate",
      reactComponent: Selection,
      props: this.#props,
    });

    const { tranboxSetting = DEFAULT_TRANBOX_SETTING } = this.#props;
    if (tranboxSetting?.transOpen) {
      this.enable();
    }
  }

  isEnabled() {
    return this.#manager.isVisible;
  }

  enable() {
    if (!this.isEnabled()) {
      this.#manager.show(this.#props);
    }
  }

  disable() {
    this.#manager.destroy();
  }

  toggle() {
    if (this.isEnabled()) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * 更新属性并根据开关状态决定启用、更新或禁用
   * @param {Object} newProps - 新的属性配置
   */
  update(newProps) {
    this.#props = resolvePromptProps({ ...this.#props, ...newProps });
    if (!this.#props.tranboxSetting?.transOpen) {
      this.disable();
      return;
    }

    if (this.isEnabled()) {
      this.#manager.setProps(this.#props);
    } else {
      this.enable();
    }
  }
}
