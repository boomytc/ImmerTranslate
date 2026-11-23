import { useState, useEffect, useRef } from "react";
import TextField from "@mui/material/TextField";
import { limitNumber, limitFloat } from "../libs/utils";

/**
 * 带输入数值验证的文本框 React 组件
 * 用于限制设置面板中的数字配置项（如字体大小、翻译延时等）输入范围
 */
function ValidationInput({
  value, // 外部传入绑定的值
  onChange, // 状态变更回调
  onBlur,
  name, // 字段键名
  min, // 最小值约束
  max, // 最大值约束
  isFloat = false, // 是否允许输入浮点数（默认为整数）
  inputProps,
  error,
  helperText,
  ...props // 其他传递给 TextField 的属性
}) {
  const [localValue, setLocalValue] = useState(() =>
    value === undefined || value === null ? "" : String(value)
  );
  const [rangeError, setRangeError] = useState("");
  const lastEmittedRef = useRef(undefined);

  // 仅在外部 prop 真正变化（而非本组件刚刚同步的值回流）时重置草稿，避免输入小数点等中间态跳动
  useEffect(() => {
    if (Object.is(lastEmittedRef.current, value)) {
      lastEmittedRef.current = undefined;
      return;
    }
    lastEmittedRef.current = undefined;
    setLocalValue(value === undefined || value === null ? "" : String(value));
    setRangeError("");
  }, [value]);

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
      setRangeError("");
      return;
    }

    const numValue = Number(trimmed);
    if (!Number.isFinite(numValue)) {
      return;
    }

    const belowMin = min !== undefined && numValue < min;
    const aboveMax = max !== undefined && numValue > max;
    if (belowMin || aboveMax) {
      if (min !== undefined && max !== undefined) {
        setRangeError(`${min} - ${max}`);
      } else if (min !== undefined) {
        setRangeError(`>= ${min}`);
      } else {
        setRangeError(`<= ${max}`);
      }
      return;
    }

    setRangeError("");
    if (isFloat || Number.isInteger(numValue)) {
      if (!Object.is(numValue, value)) {
        emitValue(numValue);
      }
    }
  };

  // 失焦时：空字符串或非数字回滚原值，越界值钳至有效范围并同步
  const handleBlur = (e) => {
    onBlur?.(e);
    const trimmed = String(localValue ?? "").trim();
    if (trimmed === "") {
      setLocalValue(value === undefined || value === null ? "" : String(value));
      setRangeError("");
      return;
    }

    const numValue = Number(trimmed);
    if (!Number.isFinite(numValue)) {
      setLocalValue(value === undefined || value === null ? "" : String(value));
      setRangeError("");
      return;
    }

    const validatedValue = isFloat
      ? limitFloat(numValue, min, max)
      : limitNumber(numValue, min, max);

    setRangeError("");
    setLocalValue(String(validatedValue));

    if (!Object.is(validatedValue, value)) {
      emitValue(validatedValue);
    }
  };

  return (
    <TextField
      {...props}
      type="number"
      name={name}
      value={localValue}
      error={Boolean(error || rangeError)}
      helperText={rangeError || helperText}
      onChange={handleLocalChange}
      onBlur={handleBlur}
      inputProps={{
        ...inputProps,
        min,
        max,
        step: inputProps?.step ?? (isFloat ? "any" : 1),
      }}
    />
  );
}

export default ValidationInput;
