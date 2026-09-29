/**
 * Floating-ball geometry for the content script.
 * Classic script (not an ES module): content.js reads globalThis.ImmerBall.
 *
 * Default is the bottom-right corner. Stored positions are viewport pixels
 * `{ left, top }` and are only clamped when read back. Snapping to an edge
 * happens when a drag ends near that edge, not on every reload.
 */
(function initImmerBall(root) {
  const BALL_SIZE = 48;
  const EDGE_MARGIN = 16;
  const SNAP_DISTANCE = 40;

  /**
   * @param {{ width?: number, height?: number } | null | undefined} viewport
   */
  function bounds(viewport) {
    const width = Number(viewport?.width);
    const height = Number(viewport?.height);
    const safeWidth = Number.isFinite(width) && width > 0 ? width : BALL_SIZE + EDGE_MARGIN * 2;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : BALL_SIZE + EDGE_MARGIN * 2;
    return {
      width: safeWidth,
      height: safeHeight,
      maxLeft: Math.max(EDGE_MARGIN, safeWidth - BALL_SIZE - EDGE_MARGIN),
      maxTop: Math.max(EDGE_MARGIN, safeHeight - BALL_SIZE - EDGE_MARGIN),
    };
  }

  /**
   * @param {{ width?: number, height?: number }} viewport
   * @returns {{ left: number, top: number }}
   */
  function defaultBallPosition(viewport) {
    const box = bounds(viewport);
    return { left: box.maxLeft, top: box.maxTop };
  }

  /**
   * @param {{ left?: number, top?: number } | null | undefined} pos
   * @param {{ width?: number, height?: number }} viewport
   * @returns {{ left: number, top: number }}
   */
  function clampBallPosition(pos, viewport) {
    const box = bounds(viewport);
    const left = Number(pos?.left);
    const top = Number(pos?.top);
    return {
      left: Math.min(box.maxLeft, Math.max(EDGE_MARGIN, Number.isFinite(left) ? left : EDGE_MARGIN)),
      top: Math.min(box.maxTop, Math.max(EDGE_MARGIN, Number.isFinite(top) ? top : EDGE_MARGIN)),
    };
  }

  /**
   * Pull each axis to the nearest edge when the ball is within SNAP_DISTANCE
   * of that edge (after the margin). A corner drag snaps both axes.
   * @param {{ left?: number, top?: number } | null | undefined} pos
   * @param {{ width?: number, height?: number }} viewport
   * @returns {{ left: number, top: number }}
   */
  function snapBallPosition(pos, viewport) {
    const box = bounds(viewport);
    let left = Number(pos?.left);
    let top = Number(pos?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return defaultBallPosition(viewport);
    const distLeft = left - EDGE_MARGIN;
    const distRight = box.width - BALL_SIZE - EDGE_MARGIN - left;
    const distTop = top - EDGE_MARGIN;
    const distBottom = box.height - BALL_SIZE - EDGE_MARGIN - top;
    if (distLeft <= SNAP_DISTANCE) left = EDGE_MARGIN;
    else if (distRight <= SNAP_DISTANCE) left = box.maxLeft;
    if (distTop <= SNAP_DISTANCE) top = EDGE_MARGIN;
    else if (distBottom <= SNAP_DISTANCE) top = box.maxTop;
    return clampBallPosition({ left, top }, viewport);
  }

  /**
   * @param {unknown} value
   * @param {{ width?: number, height?: number }} viewport
   * @returns {{ left: number, top: number } | null}
   */
  function normalizeStoredBallPosition(value, viewport) {
    if (!value || typeof value !== "object") return null;
    const left = Number(/** @type {{ left?: unknown }} */ (value).left);
    const top = Number(/** @type {{ top?: unknown }} */ (value).top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return clampBallPosition({ left, top }, viewport);
  }

  root.ImmerBall = {
    BALL_SIZE,
    EDGE_MARGIN,
    SNAP_DISTANCE,
    defaultBallPosition,
    clampBallPosition,
    snapBallPosition,
    normalizeStoredBallPosition,
  };
})(globalThis);
