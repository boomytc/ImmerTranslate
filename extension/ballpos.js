/**
 * Floating-ball geometry for the content script.
 * Classic script (not an ES module): content.js reads globalThis.ImmerBall.
 *
 * The ball lives on the left or right edge. Default is the right edge, low
 * on the page. A drag may cross the page; on release it snaps to the nearer
 * side and keeps the vertical position. Storage is `{ side, top }`.
 */
(function initImmerBall(root) {
  const BALL_SIZE = 48;
  const EDGE_MARGIN = 16;

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
   * @param {unknown} top
   * @param {{ maxTop: number }} box
   */
  function clampTop(top, box) {
    const value = Number(top);
    return Math.min(box.maxTop, Math.max(EDGE_MARGIN, Number.isFinite(value) ? value : EDGE_MARGIN));
  }

  /**
   * @param {"left" | "right"} side
   * @param {number} top
   * @param {{ width?: number, height?: number }} viewport
   */
  function placeOnSide(side, top, viewport) {
    const box = bounds(viewport);
    const edge = side === "left" ? "left" : "right";
    return {
      side: edge,
      top: clampTop(top, box),
      left: edge === "left" ? EDGE_MARGIN : box.maxLeft,
    };
  }

  /**
   * @param {{ width?: number, height?: number }} viewport
   */
  function defaultBallPosition(viewport) {
    const box = bounds(viewport);
    return placeOnSide("right", box.maxTop, viewport);
  }

  /**
   * Free movement while dragging. Does not snap.
   * @param {{ left?: number, top?: number } | null | undefined} pos
   * @param {{ width?: number, height?: number }} viewport
   */
  function clampBallPosition(pos, viewport) {
    const box = bounds(viewport);
    const left = Number(pos?.left);
    const top = Number(pos?.top);
    return {
      left: Math.min(box.maxLeft, Math.max(EDGE_MARGIN, Number.isFinite(left) ? left : EDGE_MARGIN)),
      top: clampTop(top, box),
    };
  }

  /**
   * On release, snap to the nearer vertical edge and keep `top`.
   * @param {{ left?: number, top?: number } | null | undefined} pos
   * @param {{ width?: number, height?: number }} viewport
   */
  function snapBallPosition(pos, viewport) {
    const box = bounds(viewport);
    const left = Number(pos?.left);
    const top = Number(pos?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return defaultBallPosition(viewport);
    const center = left + BALL_SIZE / 2;
    const side = center <= box.width / 2 ? "left" : "right";
    return placeOnSide(side, top, viewport);
  }

  /**
   * @param {unknown} value
   * @param {{ width?: number, height?: number }} viewport
   * @returns {{ side: "left" | "right", top: number, left: number } | null}
   */
  function normalizeStoredBallPosition(value, viewport) {
    if (!value || typeof value !== "object") return null;
    const record = /** @type {{ side?: unknown, left?: unknown, top?: unknown }} */ (value);
    const top = Number(record.top);
    if (!Number.isFinite(top)) return null;
    if (record.side === "left" || record.side === "right") {
      return placeOnSide(record.side, top, viewport);
    }
    const left = Number(record.left);
    if (!Number.isFinite(left)) return null;
    return snapBallPosition({ left, top }, viewport);
  }

  root.ImmerBall = {
    BALL_SIZE,
    EDGE_MARGIN,
    defaultBallPosition,
    clampBallPosition,
    snapBallPosition,
    normalizeStoredBallPosition,
  };
})(globalThis);
