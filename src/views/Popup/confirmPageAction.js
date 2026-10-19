/**
 * 划词开关只撤回 transOpen。当前值已经不是这次写入的结果时不改。
 */
export function undoTranboxTransOpen(previousOpen, writtenOpen) {
  return (current) => {
    const tranbox = current?.tranboxSetting;
    if (!tranbox || typeof tranbox !== "object") return {};
    if (tranbox.transOpen !== writtenOpen) return {};
    return {
      tranboxSetting: {
        ...tranbox,
        transOpen: previousOpen,
      },
    };
  };
}

/**
 * 乐观更新之后以页面回复为准。回复带 error、页面没有内容脚本，
 * 或确认函数拒绝时，回滚并交给调用方提示。
 * rollback 应只撤回这次写入的字段。
 */
export async function confirmPageAction({ send, confirm, rollback }) {
  let response;
  try {
    response = await send();
  } catch (error) {
    await rollback?.();
    return { ok: false, error };
  }

  if (!response || response.error || response.code === "NO_RECEIVER") {
    const error = new Error(
      response?.error || "The page did not confirm the change."
    );
    await rollback?.();
    return { ok: false, error, response };
  }

  try {
    await confirm?.(response);
  } catch (error) {
    await rollback?.();
    return { ok: false, error, response };
  }

  return { ok: true, response };
}
