import { kissLog, logger } from "./log";

const createAbortError = () =>
  new DOMException("The operation was aborted.", "AbortError");

const isAbortError = (error) => error?.name === "AbortError";

const raceWithAbort = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  let onAbort;
  const abortPromise = new Promise((_, reject) => {
    onAbort = () => reject(createAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  return Promise.race([promise, abortPromise]).finally(() => {
    signal.removeEventListener("abort", onAbort);
  });
};

const destroyEntry = (entry) => {
  if (!entry) return;
  if (typeof entry.then === "function") {
    entry.then((instance) => instance?.destroy?.()).catch(() => {});
    return;
  }
  try {
    entry.destroy?.();
  } catch {
    // 底层实例可能已释放
  }
};

/**
 * Chrome 浏览器内置翻译
 */
/**
 * Chrome 浏览器本地内置 AI (Gemini Nano) 翻译与语种检测服务的封装类。
 */
class ChromeTranslator {
  // 缓存不同语种方向的 Translator 实例或其初始化 Promise (e.g. key: "en_zh")
  #translatorMap = new Map();
  // 缓存全局唯一的本地 LanguageDetector 实例 Promise
  #detectorPromise = null;
  // 缓存代数：重置时递增，防止在途初始化完成后回写旧实例覆盖新缓存
  #generation = 0;

  constructor(options = {}) {
    // 支持接收模型下载进度的回调通知
    this.onProgress = options.onProgress || this.#defaultProgressHandler;
  }

  /**
   * 默认的模型下载进度处理器，用于输出调试日志
   */
  #defaultProgressHandler(type, progress) {
    kissLog(`Downloading ${type} model: ${progress}%`);
  }

  #resetDetector() {
    const current = this.#detectorPromise;
    this.#detectorPromise = null;
    destroyEntry(current);
  }

  #resetTranslators() {
    this.#generation += 1;
    const entries = [...this.#translatorMap.values()];
    this.#translatorMap.clear();
    for (const entry of entries) {
      destroyEntry(entry);
    }
  }

  /**
   * 单例模式获取或初始化本地语言检测器 (LanguageDetector)
   */
  #getDetectorPromise() {
    if (!this.#detectorPromise) {
      const detectorPromise = (async () => {
        try {
          const availability = await LanguageDetector.availability();
          if (availability === "unavailable") {
            throw new Error("LanguageDetector unavailable");
          }

          const detector = await LanguageDetector.create({
            monitor: (m) => this._monitorProgress(m, "detector"),
          });
          if (this.#detectorPromise !== detectorPromise) {
            destroyEntry(detector);
            throw new Error("LanguageDetector cache was reset");
          }
          return detector;
        } catch (error) {
          if (this.#detectorPromise === detectorPromise) {
            this.#detectorPromise = null; // 初始化失败时重置缓存，以便下次能够重试
          }
          throw error;
        }
      })();
      this.#detectorPromise = detectorPromise;
    }

    return this.#detectorPromise;
  }

  /**
   * 依据源语言与目标语言创建或复用特定的 Translator 实例。
   * @param {string} sourceLanguage 源语言
   * @param {string} targetLanguage 目标翻译语言
   */
  #createTranslator(sourceLanguage, targetLanguage) {
    const key = `${sourceLanguage}_${targetLanguage}`;
    if (this.#translatorMap.has(key)) {
      return this.#translatorMap.get(key);
    }

    const generation = this.#generation;
    const translatorPromise = (async () => {
      try {
        const avail = await Translator.availability({
          sourceLanguage,
          targetLanguage,
        });
        if (avail === "unavailable") {
          throw new Error(
            `Translator ${sourceLanguage}_${targetLanguage} unavailable`
          );
        }

        const translator = await Translator.create({
          sourceLanguage,
          targetLanguage,
          monitor: (m) => this._monitorProgress(m, `translator (${key})`),
        });
        if (
          generation !== this.#generation ||
          this.#translatorMap.get(key) !== translatorPromise
        ) {
          destroyEntry(translator);
          throw new Error("Translator cache was reset during initialization");
        }
        this.#translatorMap.set(key, translator);

        return translator;
      } catch (error) {
        if (
          generation === this.#generation &&
          this.#translatorMap.get(key) === translatorPromise
        ) {
          this.#translatorMap.delete(key); // 创建失败立刻移出缓存，以允许重新发起初始化
        }
        throw error;
      }
    })();

    this.#translatorMap.set(key, translatorPromise);
    return translatorPromise;
  }

  /**
   * 绑定 Chrome 内置模型在后台离线下载时的事件监听，获取并回调下载进度。
   */
  _monitorProgress(monitorable, type) {
    monitorable.addEventListener("downloadprogress", (e) => {
      const progress = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
      this.onProgress(type, progress);
    });
  }

  /**
   * 检测一段文本的语言类别。
   * @param {string} text 待识别文本
   * @param {number} [confidenceThreshold=0.4] 置信度过滤阈值，默认 0.4。低于此置信度则判定为识别失败
   * @param {Object} [options] 调用选项
   * @param {AbortSignal} [options.signal] 取消信号
   * @returns {Promise<[string, string]>} [语言简写代码, 报错信息]
   */
  async detectLanguage(text, confidenceThreshold = 0.4, { signal } = {}) {
    if (!text) {
      return ["", "Input text cannot be empty."];
    }
    if (signal?.aborted) {
      throw createAbortError();
    }

    try {
      const detector = await raceWithAbort(this.#getDetectorPromise(), signal);
      if (signal?.aborted) {
        throw createAbortError();
      }
      const results = await raceWithAbort(
        signal ? detector.detect(text, { signal }) : detector.detect(text),
        signal
      );

      if (!results || results.length === 0) {
        return ["", "No language could be detected."];
      }

      const { detectedLanguage, confidence } = results[0];
      // 过滤低置信度的噪音识别结果，防止误报；不再复用跨标签页的历史语言。
      if (confidence < confidenceThreshold) {
        return [
          "",
          `Confidence of test results (${detectedLanguage} ${confidence.toFixed(
            2
          )}) below the set threshold ${confidenceThreshold}。`,
        ];
      }

      return [detectedLanguage, ""];
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw isAbortError(error) ? error : createAbortError();
      }
      // 底层 detector 发生异常时主动重置，避免失效实例持续卡死后续识别。
      this.#resetDetector();
      kissLog("detectLanguage", error, `(${text})`);
      return ["", error.message];
    }
  }

  /**
   * 本地翻译单条文本核心方法。
   * @param {string} text 原文字符串
   * @param {string} targetLanguage 目标语种
   * @param {string} [sourceLanguage="auto"] 源语种。若为 "auto" 则先调检测 API
   * @param {Object} [options] 调用选项
   * @param {AbortSignal} [options.signal] 取消信号
   * @returns {Promise<[string, string, string]>} [译文字符串, 最终源语言代码, 报错信息]
   */
  async translateText(
    text,
    targetLanguage,
    sourceLanguage = "auto",
    { signal } = {}
  ) {
    if (!text || !targetLanguage || typeof text !== "string") {
      return ["", sourceLanguage, "Input text cannot be empty."];
    }
    if (signal?.aborted) {
      throw createAbortError();
    }

    try {
      let finalSourceLanguage = sourceLanguage;
      if (sourceLanguage === "auto") {
        const [detectedLanguage, detectionError] = await this.detectLanguage(
          text,
          0.4,
          { signal }
        );
        if (detectionError || !detectedLanguage) {
          const reason =
            detectionError || "Unable to determine source language.";
          return [
            "",
            finalSourceLanguage,
            `Automatic detection of source language failed: ${reason}`,
          ];
        }
        finalSourceLanguage = detectedLanguage;
      }

      if (finalSourceLanguage === targetLanguage) {
        // 源语言与目标语言一致时返回原文，由上层 isSame 判定跳过写入；
        // 这里不能上报 error，否则会被当作翻译失败弹提示。
        return [text, finalSourceLanguage, ""];
      }

      const translator = await raceWithAbort(
        this.#createTranslator(finalSourceLanguage, targetLanguage),
        signal
      );
      if (signal?.aborted) {
        throw createAbortError();
      }
      const translatedText = await raceWithAbort(
        signal
          ? translator.translate(text, { signal })
          : translator.translate(text),
        signal
      );

      return [translatedText, finalSourceLanguage, ""];
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw isAbortError(error) ? error : createAbortError();
      }

      kissLog("translateText", error, `(${text})`);

      // Chrome 本地 AI 出现底层通用崩溃时，销毁并清空缓存实例以便下次自动重建。
      if (
        error &&
        error.message &&
        error.message.includes("Other generic failures occurred")
      ) {
        logger.info("Generic failure detected, resetting translator cache.");
        this.#resetTranslators();
      }

      return ["", sourceLanguage, error.message];
    }
  }
}

// 导出全局单例实例及快捷函数，供 background.js 中的指令分发器直接调用
const chromeTranslator = new ChromeTranslator();

export const chromeDetect = (args) =>
  chromeTranslator.detectLanguage(args.text, 0.4, {
    signal: args?.signal || args?.opts?.signal,
  });
export const chromeTranslate = (args) =>
  chromeTranslator.translateText(args.text, args.to, args.from, {
    signal: args?.signal || args?.opts?.signal,
  });
