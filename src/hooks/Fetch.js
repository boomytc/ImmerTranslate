import { useEffect, useState } from "react";

/**
 * 立即执行异步任务的 Hook
 * @param {function} fn 异步函数
 * @param {*} arg 传入参数
 */
export const useAsyncNow = (fn, arg) => {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    if (!fn) {
      setState({ data: null, loading: false, error: null });
      return () => {
        active = false;
      };
    }

    setState({ data: null, loading: true, error: null });
    void (async () => {
      try {
        const data = await fn(arg);
        if (active) setState({ data, loading: false, error: null });
      } catch (err) {
        if (active) {
          setState({
            data: null,
            loading: false,
            error: err?.message || "An unknown error occurred",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [fn, arg]);

  return state;
};
