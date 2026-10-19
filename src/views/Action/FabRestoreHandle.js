const EDGES = ["left", "right", "top", "bottom"];
const HANDLE_LENGTH = 48;
const HANDLE_THICKNESS = 8;
const DEFAULT_FAB_SIZE = 56;

const HANDLE_BASE = {
  position: "fixed",
  padding: "0",
  margin: "0",
  border: "0",
  background: "rgba(32, 33, 36, 0.45)",
  zIndex: "2147483646",
  cursor: "pointer",
};

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * 悬浮球存的是像素坐标和所贴的边。恢复条贴同一边，
 * 交叉轴对准球心；窗口变小时把条收回可视区。
 * 没有存过位置时，贴左边缘的垂直正中。
 */
export function fabRestoreHandleStyle(fabConfig, viewport) {
  const edge = EDGES.includes(fabConfig?.edge) ? fabConfig.edge : "left";
  const vertical = edge === "left" || edge === "right";
  const fabSize = finite(fabConfig?.size) ?? DEFAULT_FAB_SIZE;
  const saved = finite(vertical ? fabConfig?.y : fabConfig?.x);
  const limit = finite(vertical ? viewport?.height : viewport?.width);
  let cross = null;
  if (saved == null) {
    cross = limit != null && limit > 0 ? limit / 2 : null;
  } else {
    const center = saved + fabSize / 2;
    cross =
      limit != null && limit > 0
        ? clamp(
            center,
            HANDLE_LENGTH / 2,
            Math.max(HANDLE_LENGTH / 2, limit - HANDLE_LENGTH / 2)
          )
        : center;
  }
  const crossStyle = cross == null ? "50%" : `${cross}px`;
  const style = {
    ...HANDLE_BASE,
    width: vertical ? `${HANDLE_THICKNESS}px` : `${HANDLE_LENGTH}px`,
    height: vertical ? `${HANDLE_LENGTH}px` : `${HANDLE_THICKNESS}px`,
  };
  if (edge === "right") {
    return {
      ...style,
      right: "0",
      top: crossStyle,
      transform: "translateY(-50%)",
      borderRadius: "6px 0 0 6px",
    };
  }
  if (edge === "top") {
    return {
      ...style,
      top: "0",
      left: crossStyle,
      transform: "translateX(-50%)",
      borderRadius: "0 0 6px 6px",
    };
  }
  if (edge === "bottom") {
    return {
      ...style,
      bottom: "0",
      left: crossStyle,
      transform: "translateX(-50%)",
      borderRadius: "6px 6px 0 0",
    };
  }
  return {
    ...style,
    left: "0",
    top: crossStyle,
    transform: "translateY(-50%)",
    borderRadius: "0 6px 6px 0",
  };
}

function currentViewport() {
  return {
    width: document.documentElement?.clientWidth || window.innerWidth || 0,
    height: document.documentElement?.clientHeight || window.innerHeight || 0,
  };
}

/** 用户脚本里悬浮球收起后，贴在原来的边缘和高度，点一下恢复本站显示。 */
export function mountFabRestoreHandle({ label, onClick, fabConfig, viewport }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kt-fab-restore-handle";
  button.setAttribute("aria-label", label || "Show on this site");
  const readViewport = () =>
    typeof viewport === "function" ? viewport() : viewport || currentViewport();
  const apply = () => {
    Object.assign(
      button.style,
      fabRestoreHandleStyle(fabConfig, readViewport())
    );
  };
  apply();
  window.addEventListener("resize", apply);
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  };
  button.addEventListener("click", handleClick);
  (document.documentElement || document.body).appendChild(button);
  return () => {
    window.removeEventListener("resize", apply);
    button.removeEventListener("click", handleClick);
    button.remove();
  };
}
