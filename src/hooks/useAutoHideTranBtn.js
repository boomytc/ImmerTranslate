import { useEffect } from "react";

/**
 * 翻译按钮自动隐藏机制自定义 Hook。
 * 当用户在页面中点击右键，或者页面中的文字选区被清空（Collapsed）时，自动隐藏划词翻译触发按钮。
 * @param {boolean} showBtn 按钮当前是否显示
 * @param {function} setShowBtn 控制按钮显示隐藏的 set 函数
 * @param {function} getSelection 获取当前有效选区
 */
export default function useAutoHideTranBtn(
  showBtn,
  setShowBtn,
  getSelection = () => window.getSelection()
) {
  useEffect(() => {
    // 如果按钮本就处于隐藏状态，无需做任何事件监听
    if (!showBtn) return;

    /* 点击鼠标右键时，自动隐藏翻译按钮 */
    const handleMouseDown = (e) => {
      if (e.button === 2) {
        setShowBtn(false);
      }
    };

    const handleScroll = () => setShowBtn(false);

    // 监听选区变化：仅在按钮可见时生效，选区为空或被折叠后立即收起并注销监听
    const handleSelectionChange = () => {
      const selection = getSelection();
      if (!selection || selection.isCollapsed) setShowBtn(false);
    };

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.visualViewport?.addEventListener("scroll", handleScroll);
    document.addEventListener("selectionchange", handleSelectionChange);

    // 清理事件监听器
    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.visualViewport?.removeEventListener("scroll", handleScroll);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [showBtn, setShowBtn, getSelection]);
}
