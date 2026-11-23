import { useEffect, useCallback } from "react";
import { APP_CONSTS, MSG_OPEN_TRANBOX, EVENT_KISS_INNER } from "../config";

function hasOpenTranboxPopup(event) {
  const path =
    typeof event?.composedPath === "function" ? event.composedPath() : [];
  if (
    path.some((node) => {
      const role = node?.getAttribute?.("role");
      return role === "listbox" || role === "menu";
    })
  ) {
    return true;
  }

  const shadowRoot = document.getElementById(APP_CONSTS.boxID)?.shadowRoot;
  return Boolean(shadowRoot?.querySelector('[role="listbox"], [role="menu"]'));
}

function isTranboxLocked(hideClickAway) {
  if (typeof hideClickAway === "boolean") {
    return !hideClickAway;
  }
  const shadowRoot = document.getElementById(APP_CONSTS.boxID)?.shadowRoot;
  return Boolean(shadowRoot?.querySelector('[data-kt-tranbox-lock="true"]'));
}

function isEventInsideTranbox(event) {
  const host = document.getElementById(APP_CONSTS.boxID);
  if (!host) return false;
  const path =
    typeof event?.composedPath === "function" ? event.composedPath() : [];
  if (
    path.includes(host) ||
    (host.shadowRoot && path.includes(host.shadowRoot))
  ) {
    return true;
  }
  const activeElement = document.activeElement;
  return Boolean(
    activeElement && (activeElement === host || host.contains(activeElement))
  );
}

export default function useTranboxShortcuts({
  showBox,
  setShowBox,
  hideClickAway,
  handleToggleTranbox,
  handleOpenTranbox,
}) {
  // 快捷展开/隐藏翻译面板的切换函数
  const handleToggle = useCallback(() => {
    if (showBox) {
      setShowBox(false);
    } else {
      handleToggleTranbox();
    }
  }, [showBox, handleToggleTranbox, setShowBox]);

  // 副作用：监听自定义打开翻译面板的 DOM 通信事件（浏览器扩展快捷键触发时会广播此内部消息）
  useEffect(() => {
    const handleStatusUpdate = (event) => {
      if (event.detail?.action === MSG_OPEN_TRANBOX) {
        const text = event.detail?.args?.text?.trim();
        if (text) {
          handleOpenTranbox?.(text);
          return;
        }
        handleToggle();
      }
    };

    document.addEventListener(EVENT_KISS_INNER, handleStatusUpdate);
    return () => {
      document.removeEventListener(EVENT_KISS_INNER, handleStatusUpdate);
    };
  }, [handleToggle, handleOpenTranbox]);

  // 翻译面板打开时在捕获阶段监听 Escape 关闭（避免全屏输入框阻断冒泡），
  // 同时避让输入法组合态、面板内下拉/溢出菜单，以及已锁定且焦点在宿主页面时的按键。
  useEffect(() => {
    if (!showBox) return undefined;

    const handleKeyDown = (event) => {
      if (
        event.key !== "Escape" ||
        event.isComposing ||
        event.defaultPrevented
      ) {
        return;
      }
      if (hasOpenTranboxPopup(event)) {
        return;
      }
      if (isTranboxLocked(hideClickAway) && !isEventInsideTranbox(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setShowBox(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hideClickAway, showBox, setShowBox]);
}
