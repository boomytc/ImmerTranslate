/**
 * 乐观更新之后以页面回复为准。回复带 error、页面没有内容脚本，
 * 或确认函数拒绝时，回滚并交给调用方提示。
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
