const EDGES = ["left", "right", "top", "bottom"];

const HANDLE_BASE = {
  position: "fixed",
  padding: "0",
  margin: "0",
  border: "0",
  background: "rgba(32, 33, 36, 0.45)",
  zIndex: "2147483646",
  cursor: "pointer",
};

function alongPercent(value) {
  const ratio =
    typeof value === "number" && Number.isFinite(value) ? value : 0.5;
  return `${Math.min(1, Math.max(0, ratio)) * 100}%`;
}

/** 贴在悬浮球收起前的那一边。没有拖过时就是左边缘的垂直正中。 */
export function fabRestoreHandleStyle(fabConfig) {
  const edge = EDGES.includes(fabConfig?.edge) ? fabConfig.edge : "left";
  const vertical = edge === "left" || edge === "right";
  const style = {
    ...HANDLE_BASE,
    width: vertical ? "8px" : "48px",
    height: vertical ? "48px" : "8px",
  };
  if (edge === "right") {
    return {
      ...style,
      right: "0",
      top: alongPercent(fabConfig?.y),
      transform: "translateY(-50%)",
      borderRadius: "6px 0 0 6px",
    };
  }
  if (edge === "top") {
    return {
      ...style,
      top: "0",
      left: alongPercent(fabConfig?.x),
      transform: "translateX(-50%)",
      borderRadius: "0 0 6px 6px",
    };
  }
  if (edge === "bottom") {
    return {
      ...style,
      bottom: "0",
      left: alongPercent(fabConfig?.x),
      transform: "translateX(-50%)",
      borderRadius: "6px 6px 0 0",
    };
  }
  return {
    ...style,
    left: "0",
    top: alongPercent(fabConfig?.y),
    transform: "translateY(-50%)",
    borderRadius: "0 6px 6px 0",
  };
}

/** 用户脚本里悬浮球收起后，贴在原来的边缘，点一下恢复本站显示。 */
export function mountFabRestoreHandle({ label, onClick, fabConfig }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kt-fab-restore-handle";
  button.setAttribute("aria-label", label || "Show on this site");
  Object.assign(button.style, fabRestoreHandleStyle(fabConfig));
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  };
  button.addEventListener("click", handleClick);
  (document.documentElement || document.body).appendChild(button);
  return () => {
    button.removeEventListener("click", handleClick);
    button.remove();
  };
}
