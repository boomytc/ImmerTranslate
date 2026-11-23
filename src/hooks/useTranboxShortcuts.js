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

export default function useTranboxShortcuts({
  showBox,
  setShowBox,
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

  // 翻译面板打开时按 Escape 关闭，避让输入法组合态及面板内已打开的下拉/溢出菜单
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
      event.preventDefault();
      event.stopPropagation();
      setShowBox(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showBox, setShowBox]);
}
