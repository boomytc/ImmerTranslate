import {
  DEFAULT_BATCH_INTERVAL,
  DEFAULT_BATCH_SIZE,
  DEFAULT_BATCH_LENGTH,
} from "../config";

const abortError = () =>
  new DOMException("The operation was aborted.", "AbortError");

export const normalizeBatchConcurrency = (batchConcurrency) => {
  const configuredConcurrency = Number(batchConcurrency);
  return Number.isFinite(configuredConcurrency) && configuredConcurrency >= 1
    ? Math.floor(configuredConcurrency)
    : 1;
};

/** Batch requests while keeping each caller's cancellation independent. */
const BatchQueue = (
  taskFn,
  {
    batchInterval = DEFAULT_BATCH_INTERVAL,
    batchSize = DEFAULT_BATCH_SIZE,
    batchLength = DEFAULT_BATCH_LENGTH,
    batchConcurrency = 1,
    onIdle,
  } = {}
) => {
  const queue = [];
  const activeBatches = new Set();
  const concurrency = normalizeBatchConcurrency(batchConcurrency);
  let timer = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const notifyIdleIfEmpty = () => {
    if (queue.length === 0 && activeBatches.size === 0 && timer === null) {
      onIdle?.();
    }
  };

  const isQueueReadyImmediately = () => {
    if (queue.length >= batchSize) return true;
    let totalLength = 0;
    for (const task of queue) {
      totalLength += task.payload?.length || 0;
      if (totalLength > batchLength) return true;
    }
    return false;
  };

  const settle = (task, method, value) => {
    if (task.settled) return;
    task.settled = true;
    if (task.onAbort) {
      task.args.signal.removeEventListener("abort", task.onAbort);
      task.onAbort = null;
    }
    task[method](value);
  };

  const cancelTask = (task) => {
    if (task.settled) return;
    settle(task, "reject", abortError());

    if (task.batch) {
      // Never change dispatched indexes: other results still use those IDs.
      if (task.batch.tasks.every((item) => item.settled)) {
        task.batch.controller.abort();
      }
    } else {
      const index = queue.indexOf(task);
      if (index !== -1) queue.splice(index, 1);
      if (queue.length === 0) {
        clearTimer();
        notifyIdleIfEmpty();
      }
    }
  };

  const scheduleProcessing = (delay = batchInterval) => {
    if (
      timer !== null ||
      activeBatches.size >= concurrency ||
      queue.length === 0
    ) {
      return;
    }
    timer = setTimeout(processQueue, delay);
  };

  const processQueue = async () => {
    clearTimer();
    if (queue.length === 0 || activeBatches.size >= concurrency) {
      notifyIdleIfEmpty();
      return;
    }

    let length = 0;
    let count = 0;
    let truncatedByLength = false;
    for (const task of queue) {
      const textLength = task.payload?.length || 0;
      if (count >= batchSize) {
        break;
      }
      if (length + textLength > batchLength && count > 0) {
        truncatedByLength = true;
        break;
      }
      length += textLength;
      count++;
    }
    if (count === 0) {
      notifyIdleIfEmpty();
      return;
    }

    const tasks = queue.splice(0, count);
    const batch = { tasks, controller: new AbortController() };
    activeBatches.add(batch);
    tasks.forEach((task) => {
      task.batch = batch;
    });
    // 批次因 batchLength 截断或剩余队列已达到立即发车条件且仍有并发空位时，立刻调度下一批。
    if (
      activeBatches.size < concurrency &&
      queue.length > 0 &&
      (truncatedByLength || isQueueReadyImmediately())
    ) {
      scheduleProcessing(0);
    }

    try {
      const firstArgs = tasks[0].args;
      // Preserve the generic no-arguments API when nobody supplies a signal.
      const batchArgs =
        firstArgs || tasks.some((task) => task.args?.signal)
          ? { ...firstArgs, signal: batch.controller.signal }
          : firstArgs;
      const result = taskFn(
        tasks.map((task) => task.payload),
        batchArgs
      );

      if (result && typeof result[Symbol.asyncIterator] === "function") {
        for await (const item of result) {
          const task = tasks[item.id];
          if (!task || task.settled) continue;
          const isComplete = item.isComplete !== false;
          task.args?.onStreamChunk?.({
            id: item.id,
            text: isComplete ? item.result : item.partialText,
            isComplete,
          });
          // A callback can synchronously cancel its own request.
          if (isComplete) settle(task, "resolve", item.result);
        }
        tasks.forEach((task, index) => {
          settle(
            task,
            "reject",
            new Error("No response for item at index " + index)
          );
        });
      } else {
        const responses = await result;
        if (!Array.isArray(responses)) {
          throw new Error("responses format error");
        }
        tasks.forEach((task, index) => {
          if (responses[index]) {
            settle(task, "resolve", responses[index]);
          } else {
            settle(
              task,
              "reject",
              new Error("No response for item at index " + index)
            );
          }
        });
      }
    } catch (error) {
      tasks.forEach((task) => settle(task, "reject", error));
    } finally {
      tasks.forEach((task) => {
        task.batch = null;
      });
      // Cancellation settles callers immediately, but only completion of the
      // task function/iterator releases this batch's concurrency slot.
      activeBatches.delete(batch);
      if (queue.length > 0) {
        scheduleProcessing(isQueueReadyImmediately() ? 0 : batchInterval);
      } else {
        notifyIdleIfEmpty();
      }
    }
  };

  const addTask = (payload, args) => {
    if (args?.signal?.aborted) return Promise.reject(abortError());

    return new Promise((resolve, reject) => {
      const task = {
        payload,
        args,
        resolve,
        reject,
        settled: false,
        batch: null,
        onAbort: null,
      };
      queue.push(task);
      if (args?.signal) {
        task.onAbort = () => cancelTask(task);
        args.signal.addEventListener("abort", task.onAbort, { once: true });
        if (args.signal.aborted) cancelTask(task);
      }
      if (task.settled) return;

      if (isQueueReadyImmediately()) {
        void processQueue();
      } else {
        scheduleProcessing();
      }
    });
  };

  return { addTask };
};

const queueMap = new Map();

/** Reuse a queue for a provider, language pair, and request configuration. */
export const getBatchQueue = (key, taskFn, options) => {
  if (queueMap.has(key)) return queueMap.get(key);
  let queue;
  queue = BatchQueue(taskFn, {
    ...options,
    onIdle: () => {
      if (queueMap.get(key) === queue) {
        queueMap.delete(key);
      }
    },
  });
  queueMap.set(key, queue);
  return queue;
};
