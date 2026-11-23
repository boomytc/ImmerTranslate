import { useState, useEffect, useRef } from "react";
import { limitNumber } from "../libs/utils";
import { debouncePutTranBox, getTranBox } from "../libs/storage";
import { isIframe } from "../libs/iframe";
import {
  getMaxTranBoxContentWidth,
  getMaxTranBoxContentHeight,
  getMaxTranBoxX,
  getMaxTranBoxY,
  getTranBoxOuterWidth,
  getTranBoxOuterHeight,
} from "../libs/tranboxPosition";

/**
 * 限制翻译框的尺寸和位置，确保其不会溢出当前浏览器视口
 * @param {Object} size 当前翻译框的内容尺寸 {w, h}
 * @param {Object} position 当前翻译框的坐标位置 {x, y}
 * @returns {Object} 修正后的安全尺寸和位置 {size, position}
 */
function clampTranBoxBounds(size, position) {
  const nextW = Math.min(size.w, getMaxTranBoxContentWidth());
  const nextH = Math.min(size.h, getMaxTranBoxContentHeight());

  return {
    size: {
      w: nextW,
      h: nextH,
    },
    position: {
      x: limitNumber(position.x, 0, getMaxTranBoxX(nextW)),
      y: limitNumber(position.y, 0, getMaxTranBoxY(nextH)),
    },
  };
}

/**
 * 划词翻译框位置、尺寸及基础风格状态管理器自定义 Hook
 */
export default function useTranBoxState(tranboxSetting) {
  // 解构获取翻译面板的初始参数设置项
  const {
    simpleStyle: initSimpleStyle = false,
    hideClickAway: initHideClickAway = false,
    followSelection: initFollowMouse = false,
    boxOffsetX = 0,
    boxOffsetY = 10,
  } = tranboxSetting;

  // 根据当前分辨率和极简模式风格，计算初始理想宽度。若为极简模式则采用 400，否则在 400 ~ 800 之间取当前窗口宽度的合适范围。
  const maxBoxWidth = getMaxTranBoxContentWidth();
  const defaultBoxWidth = initSimpleStyle
    ? 400
    : limitNumber(window.innerWidth, 400, 800);
  const boxWidth = Math.min(defaultBoxWidth, maxBoxWidth);
  // 计算初始理想高度。若为极简模式则采用 200，否则在 200 ~ 600 之间取当前窗口高度的合适范围。
  const maxBoxHeight = getMaxTranBoxContentHeight();
  const defaultBoxHeight = initSimpleStyle
    ? 200
    : limitNumber(maxBoxHeight, 200, 600);
  const boxHeight = Math.min(defaultBoxHeight, maxBoxHeight);
  const initialBoxSizeRef = useRef({
    w: boxWidth,
    h: boxHeight,
  });
  const initialBoxPositionRef = useRef({
    x: (window.innerWidth - getTranBoxOuterWidth(boxWidth)) / 2,
    y: (window.innerHeight - getTranBoxOuterHeight(boxHeight)) / 2,
  });

  // 面板尺寸状态管理 (w: 宽, h: 高)
  const [boxSize, setBoxSize] = useState(initialBoxSizeRef.current);

  // 面板位置状态管理 (x: 左间距, y: 顶间距)
  const [boxPosition, setBoxPosition] = useState(initialBoxPositionRef.current);

  const boxSizeRef = useRef(boxSize);
  const boxPositionRef = useRef(boxPosition);
  boxSizeRef.current = boxSize;
  boxPositionRef.current = boxPosition;

  const hasLoadedStorageRef = useRef(false);
  const lastPersistedRef = useRef(null);

  // 极简样式状态
  const [simpleStyle, setSimpleStyle] = useState(initSimpleStyle);
  // 点击空白处是否收起状态
  const [hideClickAway, setHideClickAway] = useState(initHideClickAway);
  // 是否跟随文字选区定位状态
  const [followSelection, setFollowSelection] = useState(initFollowMouse);

  // 同步外部 tranboxSetting 配置更新
  useEffect(() => {
    setSimpleStyle(initSimpleStyle);
  }, [initSimpleStyle]);

  useEffect(() => {
    setHideClickAway(initHideClickAway);
  }, [initHideClickAway]);

  useEffect(() => {
    setFollowSelection(initFollowMouse);
  }, [initFollowMouse]);

  // 首次挂载副作用：从 Storage 中读取之前保存的持久化翻译面板尺寸和位置，并根据当前浏览器窗口边界重新进行溢出修正
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { w, h, x, y } = (await getTranBox()) || {};
        if (!active) return;
        const next = clampTranBoxBounds(
          {
            w: w !== undefined ? w : initialBoxSizeRef.current.w,
            h: h !== undefined ? h : initialBoxSizeRef.current.h,
          },
          {
            x: x !== undefined ? x : initialBoxPositionRef.current.x,
            y: y !== undefined ? y : initialBoxPositionRef.current.y,
          }
        );

        lastPersistedRef.current = {
          ...(w !== undefined && h !== undefined
            ? next.size
            : initialBoxSizeRef.current),
          ...(x !== undefined && y !== undefined
            ? next.position
            : initialBoxPositionRef.current),
        };
        if (w !== undefined && h !== undefined) {
          setBoxSize(next.size);
        }
        if (x !== undefined && y !== undefined) {
          setBoxPosition(next.position);
        }
      } catch (err) {
        // 忽略异常
      } finally {
        if (active) {
          hasLoadedStorageRef.current = true;
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 监听浏览器窗口大小变化，动态限制翻译框边界，防止窗口缩小导致翻译框被挤出屏幕
  useEffect(() => {
    function handleResize() {
      const currentSize = boxSizeRef.current;
      const currentPosition = boxPositionRef.current;
      const next = clampTranBoxBounds(currentSize, currentPosition);
      if (next.size.w !== currentSize.w || next.size.h !== currentSize.h) {
        setBoxSize(next.size);
      }
      if (
        next.position.x !== currentPosition.x ||
        next.position.y !== currentPosition.y
      ) {
        setBoxPosition(next.position);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 副作用：待首次读取完成后，当翻译面板的大小或位置发生改变时，防抖写入存储持久化
  // 注意：在 iframe 内运行时，不触发持久化，避免多框架环境读写冲突导致布局错乱
  useEffect(() => {
    if (!hasLoadedStorageRef.current || isIframe) return;
    if (boxSize.w <= 0 || boxSize.h <= 0) return;
    const prev = lastPersistedRef.current;
    if (
      prev &&
      prev.w === boxSize.w &&
      prev.h === boxSize.h &&
      prev.x === boxPosition.x &&
      prev.y === boxPosition.y
    ) {
      return;
    }
    const nextSnapshot = {
      ...boxSize,
      ...boxPosition,
    };
    lastPersistedRef.current = nextSnapshot;
    debouncePutTranBox(nextSnapshot);
  }, [boxSize, boxPosition]);

  return {
    boxSize,
    setBoxSize,
    boxPosition,
    setBoxPosition,
    simpleStyle,
    setSimpleStyle,
    hideClickAway,
    setHideClickAway,
    followSelection,
    setFollowSelection,
    boxOffsetX,
    boxOffsetY,
  };
}
