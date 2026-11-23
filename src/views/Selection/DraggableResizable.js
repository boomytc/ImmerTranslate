import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import TranslationPanelSurface from "../../components/TranslationPanel/Surface";
import { limitNumber } from "../../libs/utils";
import {
  getMaxTranBoxContentWidth,
  getMaxTranBoxContentHeight,
  getMaxTranBoxX,
  getMaxTranBoxY,
  getTranBoxOuterHeight,
  getTranBoxViewportHeight,
} from "../../libs/tranboxPosition";

/**
 * Drag and resize handle for eight resize directions and header dragging.
 *
 * @param {Object} props
 * @param {string} props.direction - Direction, such as "Header", "TopLeft", or "Bottom".
 * @param {Object} props.size - Current container dimensions { w, h }.
 * @param {Function} props.setSize - React setter for container dimensions.
 * @param {Object} props.position - Current container position { x, y }.
 * @param {Function} props.setPosition - React setter for container position.
 * @param {Object} props.minSize - Minimum allowed container dimensions.
 * @param {Object} props.maxSize - Maximum allowed container dimensions.
 */
function Pointer({
  direction,
  size,
  setSize,
  position,
  setPosition,
  children,
  minSize,
  maxSize,
  getMaxPositionY,
  ...props
}) {
  // Store the pointer coordinates, position, and size at the start of a drag or resize.
  const [origin, setOrigin] = useState(null);

  // Handle pointer start.
  function handlePointerDown(e) {
    // The header contains buttons and an overflow menu as well as the drag area.
    // Pressing a control must not start a drag. Clear origin too, so the next move
    // cannot calculate its displacement from a stale starting point.
    if (e.target.closest?.("button, input, select, textarea, a")) {
      setOrigin(null);
      return;
    }

    // Capture the pointer to keep receiving events outside the element.
    e.target.setPointerCapture(e.pointerId);

    const { clientX, clientY } = e;
    setOrigin({
      x: position.x,
      y: position.y,
      w: size.w,
      h: size.h,
      clientX,
      clientY,
    });
  }

  // Handle pointer movement.
  function handlePointerMove(e) {
    const { clientX, clientY } = e;
    if (!origin) return;

    const dx = clientX - origin.clientX;
    const dy = clientY - origin.clientY;
    const maxContentW = getMaxTranBoxContentWidth();
    const maxContentH = getMaxTranBoxContentHeight();
    const maxW = Math.min(maxSize.w, maxContentW);
    const maxH = Math.min(maxSize.h, maxContentH);
    const minW = Math.min(minSize.w, maxW);
    const minH = Math.min(minSize.h, maxH);

    if (direction === "Header") {
      const nextW = limitNumber(origin.w, minW, maxW);
      const nextH = limitNumber(origin.h, minH, maxH);
      setPosition({
        x: limitNumber(origin.x + dx, 0, getMaxTranBoxX(nextW)),
        y: limitNumber(origin.y + dy, 0, getMaxPositionY(nextH)),
      });
      setSize({ w: nextW, h: nextH });
      return;
    }

    let x = origin.x;
    let y = origin.y;
    let w = limitNumber(origin.w, minW, maxW);
    let h = limitNumber(origin.h, minH, maxH);

    const resizesLeft =
      direction === "Left" ||
      direction === "TopLeft" ||
      direction === "BottomLeft";
    const resizesRight =
      direction === "Right" ||
      direction === "TopRight" ||
      direction === "BottomRight";
    const resizesTop =
      direction === "Top" ||
      direction === "TopLeft" ||
      direction === "TopRight";
    const resizesBottom =
      direction === "Bottom" ||
      direction === "BottomLeft" ||
      direction === "BottomRight";

    if (resizesLeft) {
      const minDx = Math.max(-origin.x, origin.w - maxW);
      const maxDx = Math.max(minDx, origin.w - minW);
      const clampedDx = limitNumber(dx, minDx, maxDx);
      x = origin.x + clampedDx;
      w = origin.w - clampedDx;
    } else if (resizesRight) {
      const rightMaxW = Math.max(minW, Math.min(maxW, maxContentW - origin.x));
      w = limitNumber(origin.w + dx, minW, rightMaxW);
    }

    if (resizesTop) {
      const minDy = Math.max(-origin.y, origin.h - maxH);
      const maxDy = Math.max(minDy, origin.h - minH);
      const clampedDy = limitNumber(dy, minDy, maxDy);
      y = origin.y + clampedDy;
      h = origin.h - clampedDy;
    } else if (resizesBottom) {
      const bottomMaxH = Math.max(minH, Math.min(maxH, maxContentH - origin.y));
      h = limitNumber(origin.h + dy, minH, bottomMaxH);
    }

    setPosition({
      x: limitNumber(x, 0, getMaxTranBoxX(w)),
      y: limitNumber(y, 0, getMaxPositionY(h)),
    });
    setSize({ w, h });
  }

  // Handle pointer end.
  function handlePointerUp(e) {
    e.stopPropagation();
    setOrigin(null);
  }

  // Browsers do not emit pointerup after pointercancel, so cancellation must
  // clear origin or the next hover over the header resumes a stale drag.
  const pointerProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };

  return (
    <div {...props} {...pointerProps}>
      {children}
    </div>
  );
}

/**
 * Positioned container with drag and resize support.
 */
export default function DraggableResizable({
  header,
  children,
  position = {
    x: 0,
    y: 0,
  },
  size = {
    w: 600,
    h: 400,
  },
  minSize = {
    w: 300,
    h: 200,
  },
  maxSize = {
    w: 1200,
    h: 1200,
  },
  setSize,
  setPosition,
  autoHeight,
  ...props
}) {
  // Width of the resize handles in pixels.
  const lineWidth = 4;
  const containerRef = useRef(null);

  const getMaxPositionY = useCallback(
    (contentHeight) => {
      if (!autoHeight) return getMaxTranBoxY(contentHeight);

      const outerHeight = containerRef.current?.offsetHeight;
      return Math.max(
        0,
        getTranBoxViewportHeight() -
          (outerHeight || getTranBoxOuterHeight(contentHeight))
      );
    },
    [autoHeight]
  );

  useLayoutEffect(() => {
    if (!autoHeight || !containerRef.current) return;

    const clampPosition = () => {
      setPosition((previous) => {
        const y = limitNumber(previous.y, 0, getMaxPositionY(size.h));
        return y === previous.y ? previous : { ...previous, y };
      });
    };

    clampPosition();
    const ResizeObserver = window.ResizeObserver;
    if (!ResizeObserver) return;

    const observer = new ResizeObserver(clampPosition);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoHeight, getMaxPositionY, setPosition, size.h]);

  const opts = {
    size,
    setSize,
    position,
    setPosition,
    minSize,
    maxSize,
    getMaxPositionY,
  };

  return (
    <Box
      ref={containerRef}
      className="KT-draggable"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        // Arrange the resize handles around the panel in a 3x3 CSS grid.
        display: "grid",
        gridTemplateColumns: `${lineWidth * 2}px ${size.w}px ${lineWidth * 2}px`,
        gridTemplateRows: `${lineWidth * 2}px auto ${lineWidth * 2}px`,
        zIndex: 2147483647,
        borderRadius: "16px",
        overflow: "hidden",
      }}
      {...props}
    >
      {/* ---------------- Top and side resize handles ---------------- */}
      <Pointer
        direction="TopLeft"
        style={{
          transform: `translate(${lineWidth}px, ${lineWidth}px)`,
          cursor: "nw-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="Top"
        style={{
          margin: `0 ${lineWidth}px`,
          transform: `translate(0px, ${lineWidth}px)`,
          cursor: "row-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="TopRight"
        style={{
          transform: `translate(-${lineWidth}px, ${lineWidth}px)`,
          cursor: "ne-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="Left"
        style={{
          margin: `${lineWidth}px 0`,
          transform: `translate(${lineWidth}px, 0px)`,
          cursor: "col-resize",
        }}
        {...opts}
      />

      <TranslationPanelSurface
        className="KT-draggable-body"
        bodyClassName="KT-draggable-container"
        width={size.w}
        contentHeight={size.h}
        autoHeight={autoHeight}
        header={
          <Pointer
            className="KT-draggable-header"
            direction="Header"
            style={{ cursor: "move" }}
            {...opts}
          >
            {header}
          </Pointer>
        }
      >
        {children}
      </TranslationPanelSurface>
      {/* ---------------- Right and bottom resize handles ---------------- */}
      <Pointer
        direction="Right"
        style={{
          margin: `${lineWidth}px 0`,
          transform: `translate(-${lineWidth}px, 0px)`,
          cursor: "col-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="BottomLeft"
        style={{
          transform: `translate(${lineWidth}px, -${lineWidth}px)`,
          cursor: "ne-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="Bottom"
        style={{
          margin: `0 ${lineWidth}px`,
          transform: `translate(0px, -${lineWidth}px)`,
          cursor: "row-resize",
        }}
        {...opts}
      />
      <Pointer
        direction="BottomRight"
        style={{
          transform: `translate(-${lineWidth}px, -${lineWidth}px)`,
          cursor: "nw-resize",
        }}
        {...opts}
      />
    </Box>
  );
}
