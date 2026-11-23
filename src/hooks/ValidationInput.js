import { useState, useEffect, useRef } from "react";
import TextField from "@mui/material/TextField";
import { limitNumber, limitFloat } from "../libs/utils";
import { useI18n } from "./I18n";

function getDecimalPlaces(step) {
  const text = String(step);
  const dotIndex = text.indexOf(".");
  return dotIndex === -1 ? 0 : text.length - dotIndex - 1;
}

function clampNumber(num, min, max, isFloat) {
  const boundedMin = min !== undefined ? min : -Infinity;
  const boundedMax = max !== undefined ? max : Infinity;
  return isFloat
    ? limitFloat(num, boundedMin, boundedMax)
    : limitNumber(num, boundedMin, boundedMax);
}

/**
 * 带输入数值验证的文本框 React 组件
 * 用于限制设置面板中的数字配置项（如字体大小、翻译延时等）输入范围
 */
function ValidationInput({
  value, // 外部传入绑定的值
  onChange, // 状态变更回调
  onBlur,
  onKeyDown,
  name, // 字段键名
  min, // 最小值约束
  max, // 最大值约束
  isFloat = false, // 是否允许输入浮点数（默认为整数）
  inputProps,
  error,
  helperText,
  ...props // 其他传递给 TextField 的属性
}) {
  const i18n = useI18n();
  const [localValue, setLocalValue] = useState(() =>
    value === undefined || value === null ? "" : String(value)
  );
  const [validationError, setValidationError] = useState("");
  const lastEmittedRef = useRef(undefined);
  const { step: propStep, ...restInputProps } = inputProps || {};
  const allowNegative = min === undefined || min < 0;

  // 仅在外部 prop 真正变化（而非本组件刚刚同步的值回流）时重置草稿，避免输入小数点等中间态跳动
  useEffect(() => {
    if (Object.is(lastEmittedRef.current, value)) {
      lastEmittedRef.current = undefined;
      return;
    }
    lastEmittedRef.current = undefined;
    setLocalValue(value === undefined || value === null ? "" : String(value));
    setValidationError("");
  }, [value]);

  const formatRangeError = () => {
    if (min !== undefined && max !== undefined) {
      return i18n("validation_range")
        .replace("{min}", min)
        .replace("{max}", max);
    }
    if (min !== undefined) {
      return i18n("validation_min").replace("{min}", min);
    }
    if (max !== undefined) {
      return i18n("validation_max").replace("{max}", max);
    }
    return "";
  };

  const emitValue = (nextValue) => {
    lastEmittedRef.current = nextValue;
    onChange({
      target: {
        name,
        value: nextValue,
      },
      preventDefault: () => {},
    });
  };

  // 对合法范围内的数值即时同步，确保保存按钮及时激活且回车提交最新值
  const handleLocalChange = (e) => {
    const raw = e.target.value;
    setLocalValue(raw);

    const trimmed = raw.trim();
    if (trimmed === "") {
      setValidationError("");
      return;
    }

    if (trimmed === "-") {
      if (allowNegative) {
        setValidationError("");
      } else {
        setValidationError(
          formatRangeError() || i18n("validation_number_invalid")
        );
      }
      return;
    }

    if (isFloat && (trimmed === "." || (allowNegative && trimmed === "-."))) {
      setValidationError("");
      return;
    }

    if (!isFloat && /^[+-]?\d+\.\d*$/.test(trimmed)) {
      setValidationError(i18n("validation_integer_only"));
      return;
    }

    const numValue = Number(trimmed);
    if (!Number.isFinite(numValue)) {
      setValidationError(i18n("validation_number_invalid"));
      return;
    }

    if (!isFloat && !Number.isInteger(numValue)) {
      setValidationError(i18n("validation_integer_only"));
      return;
    }

    const belowMin = min !== undefined && numValue < min;
    const aboveMax = max !== undefined && numValue > max;
    if (belowMin || aboveMax) {
      setValidationError(formatRangeError());
      return;
    }

    setValidationError("");
    if (!Object.is(numValue, value)) {
      emitValue(numValue);
    }
  };

  // 兼容键盘上下键按步长调整数值，保持与原生 number 输入一致的操作习惯
  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || props.disabled || restInputProps.readOnly) {
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
      return;
    }
    e.preventDefault();

    const trimmed = String(localValue ?? "").trim();
    const parsed = trimmed !== "" ? Number(trimmed) : NaN;
    const propTrimmed =
      value === null || value === undefined ? "" : String(value).trim();
    const parsedProp = propTrimmed !== "" ? Number(propTrimmed) : NaN;
    const fallback = Number.isFinite(parsedProp) ? parsedProp : (min ?? 0);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const parsedStep = Number(propStep);
    const step =
      Number.isFinite(parsedStep) && parsedStep > 0
        ? parsedStep
        : isFloat
          ? 0.1
          : 1;
    const delta = e.key === "ArrowUp" ? step : -step;
    const decimals = isFloat
      ? Math.max(getDecimalPlaces(step), getDecimalPlaces(base))
      : 0;
    const rawNext = isFloat
      ? Number((base + delta).toFixed(decimals))
      : Math.trunc(base + delta);
    const nextValue = clampNumber(rawNext, min, max, isFloat);

    setValidationError("");
    setLocalValue(String(nextValue));
    if (!Object.is(nextValue, value)) {
      emitValue(nextValue);
    }
  };

  // 失焦时：空字符串或非数字回滚原值，越界值钳至有效范围并同步
  const handleBlur = (e) => {
    onBlur?.(e);
    const trimmed = String(localValue ?? "").trim();
    if (trimmed === "") {
      setLocalValue(value === undefined || value === null ? "" : String(value));
      setValidationError("");
      return;
    }

    const numValue = Number(trimmed);
    if (!Number.isFinite(numValue)) {
      setLocalValue(value === undefined || value === null ? "" : String(value));
      setValidationError("");
      return;
    }

    const validatedValue = clampNumber(numValue, min, max, isFloat);

    setValidationError("");
    setLocalValue(String(validatedValue));

    if (!Object.is(validatedValue, value)) {
      emitValue(validatedValue);
    }
  };

  return (
    <TextField
      {...props}
      type="text"
      name={name}
      value={localValue}
      error={Boolean(error || validationError)}
      helperText={validationError || helperText}
      onChange={handleLocalChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      inputProps={{
        inputMode: isFloat ? "decimal" : "numeric",
        ...restInputProps,
      }}
    />
  );
}

export default ValidationInput;
