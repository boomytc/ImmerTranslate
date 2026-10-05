import { DEFAULT_FETCH_INTERVAL, DEFAULT_FETCH_LIMIT } from "../config";
import { kissLog } from "./log";

const isAbortError = (error) => error?.name === "AbortError";

const cancellationError = (message = "The operation was aborted.") =>
  new DOMException(message, "AbortError");

/**
 * 任务池（TaskPool）
 * 用于控制异步任务（如网络请求）的并发数、最小执行间隔和重试机制，防止请求过于密集被翻译服务封禁。
 */
class TaskPool {
  #pool = []; // 待执行的任务队列

  #maxRetry = 2; // 最大重试次数
  #retryInterval = 1000; // 发生错误时的重试间隔时间（毫秒）
  #limit; // 最大并发限制数
  #interval; // 任务最小启动时间间隔（毫秒），防止请求过于高频

  #currentConcurrent = 0; // 当前正在执行的任务数
  #lastExecutionTime = 0; // 上一个任务的启动时间戳，用于计算延迟
  #schedulerTimer = null; // 用于调度下一个任务的延迟定时器
  #retryTimers = new Set(); // 已失败、正在等待重试间隔的定时器
  #pendingRetries = new Set(); // 已离开队列、尚未重新入队的重试任务
  #inflight = new Set(); // 已开始执行、尚未结束的任务
  #generation = 0; // clear 时递增，用来作废这一代排队、重试和在途任务

  /**
   * 构造函数
   * @param {number} interval - 任务最小启动间隔
   * @param {number} limit - 最大并发数
   * @param {number} retryInterval - 失败重试间隔
   */
  constructor(
    interval = DEFAULT_FETCH_INTERVAL,
    limit = DEFAULT_FETCH_LIMIT,
    retryInterval = 1000
  ) {
    this.#interval = interval;
    this.#limit = limit;
    this.#retryInterval = retryInterval;
  }

  #rejectTask(task, error) {
    if (task.settled) return;
    task.settled = true;
    task.reject(error);
  }

  #resolveTask(task, value) {
    if (task.settled) return;
    task.settled = true;
    task.resolve(value);
  }

  #isCancelled(task, signal) {
    return (
      task.settled ||
      task.generation !== this.#generation ||
      Boolean(signal?.aborted)
    );
  }

  /**
   * 调度器
   * 负责从队列中取出任务，并在满足并发限制和时间间隔约束时执行它。
   */
  #scheduleNext() {
    // 如果已经有调度定时器正在等待，则不再重复调度
    if (this.#schedulerTimer) {
      return;
    }

    // 如果当前并发数已达上限，或者队列中已无任务，则无需调度
    if (this.#currentConcurrent >= this.#limit || this.#pool.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - this.#lastExecutionTime;
    // 计算距离上一次任务启动是否已满足最小间隔，如果不满足则计算所需延迟
    const delay = Math.max(0, this.#interval - timeSinceLast);

    this.#schedulerTimer = setTimeout(() => {
      this.#schedulerTimer = null;
      // 在定时器触发后，重新检查并发限制和队列状态
      if (this.#currentConcurrent < this.#limit && this.#pool.length > 0) {
        const task = this.#pool.shift();
        if (task) {
          this.#lastExecutionTime = Date.now();
          this.#execute(task);
        }
      }

      // 如果队列中还有任务，继续调度下一个
      if (this.#pool.length > 0) {
        this.#scheduleNext();
      }
    }, delay);
  }

  #scheduleRetry(task) {
    const timer = setTimeout(() => {
      this.#retryTimers.delete(timer);
      this.#pendingRetries.delete(task);
      if (task.settled || task.generation !== this.#generation) return;
      task.retry += 1;
      task.controller = null;
      this.#pool.unshift(task);
      this.#scheduleNext();
    }, this.#retryInterval);
    this.#retryTimers.add(timer);
    this.#pendingRetries.add(task);
  }

  /**
   * 执行单个任务。
   * fn 的第二个参数是本次尝试的 AbortSignal；clear 会中止它，且取消不会进入重试。
   * @param {object} task - 任务对象，包含执行函数、参数、Promise的回调和当前重试次数
   */
  async #execute(task) {
    if (task.settled || task.generation !== this.#generation) {
      this.#rejectTask(task, cancellationError("The task pool was cleared."));
      this.#scheduleNext();
      return;
    }

    const controller = new AbortController();
    task.controller = controller;
    this.#inflight.add(task);
    this.#currentConcurrent++;

    try {
      const result = await task.fn(task.args, controller.signal);
      if (this.#isCancelled(task, controller.signal)) {
        this.#rejectTask(task, cancellationError("The task pool was cleared."));
        return;
      }
      this.#resolveTask(task, result);
    } catch (err) {
      if (this.#isCancelled(task, controller.signal) || isAbortError(err)) {
        // 取消是终态：不再发起下一次请求，也不要把真实失败交给调用方。
        this.#rejectTask(
          task,
          isAbortError(err)
            ? err
            : cancellationError("The task pool was cleared.")
        );
        return;
      }

      kissLog("task pool", err);
      if (task.retry < this.#maxRetry) {
        this.#scheduleRetry(task);
      } else {
        // 达到最大重试次数后，抛出错误并拒绝 Promise
        this.#rejectTask(task, err);
      }
    } finally {
      // 任务结束，并发数递减，触发下一次调度
      this.#inflight.delete(task);
      task.controller = null;
      this.#currentConcurrent--;
      this.#scheduleNext();
    }
  }

  /**
   * 向任务池中添加一个新任务
   * @param {Function} fn - 要执行的异步函数，签名为 (args, signal) => Promise
   * @param {*} args - 函数的参数
   * @returns {Promise} 返回一个在任务完成后 resolve 的 Promise
   */
  push(fn, args) {
    return new Promise((resolve, reject) => {
      this.#pool.push({
        fn,
        args,
        resolve,
        reject,
        retry: 0,
        generation: this.#generation,
        controller: null,
        settled: false,
      });
      this.#scheduleNext();
    });
  }

  /**
   * 动态更新任务池的配置参数
   * @param {number} interval - 新的最小任务间隔（毫秒）
   * @param {number} limit - 新的最大并发数
   */
  update(interval, limit) {
    if (interval >= 0) {
      this.#interval = interval;
    }
    if (limit >= 1) {
      this.#limit = limit;
    }

    this.#scheduleNext();
  }

  /**
   * 清空任务池。
   * 排队任务、等待重试的定时器和已经开始的任务都会以 AbortError 结束；
   * 在途任务的 signal 会被中止，调用方不会收到这次尝试的成功值或真实失败。
   */
  clear() {
    this.#generation += 1;
    const error = cancellationError("The task pool was cleared.");

    for (const task of this.#pool) {
      this.#rejectTask(task, error);
    }
    this.#pool.length = 0;

    if (this.#schedulerTimer) {
      clearTimeout(this.#schedulerTimer);
      this.#schedulerTimer = null;
    }

    for (const timer of this.#retryTimers) {
      clearTimeout(timer);
    }
    this.#retryTimers.clear();
    for (const task of this.#pendingRetries) {
      this.#rejectTask(task, error);
    }
    this.#pendingRetries.clear();

    for (const task of this.#inflight) {
      task.controller?.abort(error);
      this.#rejectTask(task, error);
    }
  }
}

/**
 * 全局共享的请求池实例
 */
let fetchPool;

/**
 * 获取请求池实例（单例模式）
 * @param {number} [interval] - 任务最小启动间隔
 * @param {number} [limit] - 最大并发数
 * @returns {TaskPool}
 */
export const getFetchPool = (interval, limit) => {
  if (!fetchPool) {
    fetchPool = new TaskPool(
      interval ?? DEFAULT_FETCH_INTERVAL,
      limit ?? DEFAULT_FETCH_LIMIT
    );
  } else if (interval && limit) {
    updateFetchPool(interval, limit);
  }
  return fetchPool;
};

/**
 * 更新全局请求池参数
 * @param {number} interval - 最小间隔（毫秒）
 * @param {number} limit - 并发限制数
 */
export const updateFetchPool = (interval, limit) => {
  fetchPool?.update(interval, limit);
};

/**
 * 清空全局请求池中的所有任务
 */
export const clearFetchPool = () => {
  fetchPool?.clear();
};
