jest.mock("../config", () => ({
  DEFAULT_FETCH_INTERVAL: 0,
  DEFAULT_FETCH_LIMIT: 1,
}));

jest.mock("./log", () => ({ kissLog: jest.fn() }));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("TaskPool cancellation", () => {
  let pool;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    pool = require("./pool").getFetchPool(0, 1);
  });

  afterEach(() => {
    pool.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("clears queued tasks with AbortError without starting them", async () => {
    const task = jest.fn();
    const pending = [pool.push(task), pool.push(task)];
    const expectations = pending.map((result) =>
      expect(result).rejects.toMatchObject({ name: "AbortError" })
    );

    pool.clear();
    await Promise.all(expectations);
    jest.runOnlyPendingTimers();
    expect(task).not.toHaveBeenCalled();

    const next = pool.push(() => "next result");
    jest.runOnlyPendingTimers();
    await expect(next).resolves.toBe("next result");
  });

  test("rejects AbortError without retrying and releases the slot", async () => {
    const error = new DOMException("Cancelled", "AbortError");
    const task = jest.fn().mockRejectedValue(error);
    const nextTask = jest.fn().mockResolvedValue("next result");
    const cancelled = pool.push(task);
    const cancelledExpectation = expect(cancelled).rejects.toBe(error);
    const next = pool.push(nextTask);

    jest.runOnlyPendingTimers();
    await flushPromises();
    await cancelledExpectation;
    jest.runOnlyPendingTimers();
    await flushPromises();
    await expect(next).resolves.toBe("next result");

    jest.advanceTimersByTime(5000);
    await flushPromises();
    expect(task).toHaveBeenCalledTimes(1);
    expect(nextTask).toHaveBeenCalledTimes(1);
  });

  test("does not start a retry that is waiting on a timer after clear", async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValue("should not run");
    const pending = pool.push(task);
    const outcome = pending.then(
      (value) => ({ status: "resolved", value }),
      (error) => ({ status: "rejected", error })
    );

    jest.runOnlyPendingTimers();
    await flushPromises();
    expect(task).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);

    pool.clear();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(5000);
    await flushPromises();

    expect(task).toHaveBeenCalledTimes(1);
    await expect(outcome).resolves.toMatchObject({
      status: "rejected",
      error: expect.objectContaining({ name: "AbortError" }),
    });
  });

  test("aborts an in-flight task without retrying or producing a failure result", async () => {
    let taskSignal;
    let rejectRunning;
    const running = jest.fn(
      (_args, signal) =>
        new Promise((_resolve, reject) => {
          taskSignal = signal;
          rejectRunning = reject;
        })
    );
    const pending = pool.push(running);
    const outcome = pending.then(
      (value) => ({ status: "resolved", value }),
      (error) => ({ status: "rejected", error })
    );

    jest.runOnlyPendingTimers();
    await flushPromises();
    expect(running).toHaveBeenCalledTimes(1);
    expect(taskSignal).toBeInstanceOf(AbortSignal);
    expect(taskSignal.aborted).toBe(false);

    pool.clear();
    expect(taskSignal.aborted).toBe(true);
    rejectRunning(new Error("provider failed after stop"));
    await flushPromises();
    jest.advanceTimersByTime(5000);
    await flushPromises();

    const result = await outcome;
    expect(result.status).toBe("rejected");
    expect(result.error).toMatchObject({ name: "AbortError" });
    expect(result.error.message).not.toContain("provider failed");
    expect(running).toHaveBeenCalledTimes(1);

    const next = jest.fn().mockResolvedValue("next result");
    const nextResult = pool.push(next);
    jest.runOnlyPendingTimers();
    await flushPromises();
    await expect(nextResult).resolves.toBe("next result");
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("continues retrying ordinary failures", async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValue("recovered");
    const result = pool.push(task);

    jest.runOnlyPendingTimers();
    await flushPromises();
    expect(task).toHaveBeenCalledTimes(1);
    jest.runOnlyPendingTimers();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    await expect(result).resolves.toBe("recovered");
    expect(task).toHaveBeenCalledTimes(2);
  });
});
