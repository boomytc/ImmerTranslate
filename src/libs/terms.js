// 专业术语（terms）解析与替换纯函数模块
// 无 DOM、无日志依赖，供 translator 使用。
//
// 已知边界（设计裁定留档，统一计划 20260829 Task 7）：
// - 灾难性回溯无超时：ECMAScript 没有正则执行超时 API（语言级约束），用户自写的
//   病态正则（如嵌套量词 + 交错字面量）在极端输入上可能阻塞主线程。该风险的前置
//   条件是用户亲手书写恶意正则（自伤而非攻击面），parseTerms 已拦截非法正则、空
//   匹配与纯零宽模式，触发边界显著收敛。
//   Worker 化可以把执行移出主线程，但会引入通信、生命周期和序列化成本，
//   相对"用户自伤"的风险量级属过度工程，裁定不采用。
//
// 解析规格：
// - 多条术语以换行或 ; 分隔；每条形如 key,value，key 与 value 用最后一个英文逗号分隔（key 本身允许含逗号）。
// - key 按正则源码校验（new RegExp(key)），非法则跳过并收集进 invalid 数组（每项 { key, error }）。
// - value 允许为空（= 不翻译，替换时保留原文并包裹标记）。"省略译文"的推荐写法是整段只写
//   key（无逗号）；尾巴逗号 key, 同样按保留原文处理（非致命提醒，不阻断替换）。
// - 相同 key 只保留首次出现；按 key.length 降序排序。
// - 匹配语义：key 一律按正则源码包装为 (key) 参与 alternation，无单词边界，
//   术语在原文任意位置（含其他字母内部，如 APIKeys/APIs/myAPI）都会命中。
// - 非法输入诊断：空源术语（,value）、非法正则、空匹配、纯零宽、同源不同译文冲突
//   （conflicting-mapping）为致命诊断，hasErrors=true；尾巴逗号（key,）按保留原文
//   处理（extra-comma 非致命提醒）；重复映射（完全相同的 key,value）为非致命诊断。
//   Translator 在 hasErrors 时把 diagnostics 记入日志，合法术语仍照常应用。
// - 非字符串输入统一视为空输入。

// 致命诊断类型：存在其一则 hasErrors=true。
// extra-comma 不在其中——`key,` 按保留原文处理，仅作非致命提醒。
const FATAL_DIAGNOSTIC_TYPES = new Set([
  "empty-source-term",
  "invalid-regex",
  "empty-matching-pattern",
  "zero-width-matching-pattern",
  "conflicting-mapping",
]);

/**
 * 跳过从 src[start]（'('）开始的平衡分组，返回 ')' 之后的位置。
 * 内部的字符类与转义不参与配对计数。
 */
function skipBalancedGroup(src, start) {
  let depth = 0;
  let i = start;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (inClass) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "]") inClass = false;
      i += 1;
      continue;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "[") {
      inClass = true;
      i += 1;
      continue;
    }
    if (c === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ")") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i;
      continue;
    }
    i += 1;
  }
  return src.length; // 已通过 new RegExp 校验，理论不可达
}

/**
 * 判定正则源码是否"整个 pattern 无任何可消费原子"（纯零宽/纯断言）。
 * 此类模式（如 (?=x)、(?<=x)、\b）在空串上不匹配（先被 empty-matching 门闸
 * 放行），但在非空文本上零宽命中并逐位置注入译文。
 *
 * 可消费原子 = 字面量字符 / . / [...] / 除 \b \B 外的一切转义序列。
 * 不可确判一律按可消费处理（宁漏报交由 scanWithTerms 运行时守卫兜底，
 * 不误报废合法术语，如 a|(?=x) 这类混合臂）。
 *
 * @param {string} key 已通过 new RegExp 校验的正则源码
 * @returns {boolean} true = 纯零宽模式
 */
function isZeroWidthOnlyPattern(key) {
  if (typeof key !== "string") return false;
  const n = key.length;
  let i = 0;
  while (i < n) {
    const ch = key[i];
    if (ch === "\\") {
      const next = key[i + 1];
      if (next === "b" || next === "B") {
        i += 2; // \b \B 是零宽断言，不消费字符
        continue;
      }
      return false; // 其余转义一律按可消费（\d \s \\ \1 等）
    }
    if (ch === "[") {
      // 字符类：整类按可消费处理（类内 \b 是退格字符，与断言语义无关）
      i += 1;
      while (i < n) {
        if (key[i] === "\\") {
          i += 2;
          continue;
        }
        if (key[i] === "]") break;
        i += 1;
      }
      // 顶层字符类恒消费一个字符 = 可消费原子（计划 §2.2），判定为可消费。
      // 越过 ] 后必须 return false 而非 continue：否则 [A-Z][a-z]+ / [0-9]+ / [^abc]
      // 这类合法术语被误判纯零宽并从生产替换中静默丢弃（P1 回归锁定）。
      // 环视组内的类不受影响：(?=[a-z]) 在上面的 lookaround 分支已整体跳过。
      return false;
    }
    if (ch === "(") {
      // 环视组 (?= (?! (?<= (?<! 本身零宽：内部原子不消费字符，整组跳过。
      const isLookaround =
        key[i + 1] === "?" &&
        (key[i + 2] === "=" ||
          key[i + 2] === "!" ||
          (key[i + 2] === "<" && (key[i + 3] === "=" || key[i + 3] === "!")));
      if (isLookaround) {
        i = skipBalancedGroup(key, i);
        continue;
      }
      i += 1;
      // 命名组 (?<name> ：头部 "?<name>" 中的 ? < 与名字、> 均为语法字符
      if (key[i] === "?") {
        i += 1;
        if (key[i] === "<" && key[i + 1] !== "=" && key[i + 1] !== "!") {
          i += 1;
          while (i < n && key[i] !== ">") i += 1;
          i += 1; // 越过 >
        }
      }
      continue;
    }
    if (ch === ".") return false; // 消费任意字符
    if ("^$|?*+{})".includes(ch)) {
      i += 1; // 语法字符，非原子
      continue;
    }
    return false; // 其余字符 = 字面量，可消费
  }
  return true; // 全程未遇可消费原子 → 纯零宽
}

// 归一化入参：既接受 parsedTerms 数组，也接受 parseTerms 返回的 { terms } 对象
function toTermList(parsedTerms) {
  if (Array.isArray(parsedTerms)) return parsedTerms;
  return parsedTerms?.terms || [];
}

/**
 * 统计正则源码里的捕获组数量（普通捕获组与命名捕获组都会占用槽位）。
 * 技巧：在源码末尾挂上一个恒为空的捕获组 `()`，再对一定能匹配上它的位置取的执行。
 * 由于 match 数组长度恒等于「捕获组总数 + 1」（未参与的分组保持 undefined），
 * 只要知道数组总长即可反推源码里的捕获组个数，无需手写括号计数解析器。
 * @param {string} regexSrc
 * @returns {number}
 */
function countCaptureGroupsInSource(regexSrc) {
  try {
    const probeMatch = new RegExp(`${regexSrc}|()`).exec("");
    return probeMatch ? probeMatch.length - 2 : 0;
  } catch {
    // parseTerms 已校验过用户正则；此处命中只发生在手写非法 source 时，保守按 0。
    return 0;
  }
}

/**
 * 手动 exec 循环扫描替换，通过「分支槽位」把每次命中反查回所属术语。
 *
 * 分支身份判定：
 *   组合正则 = patterns.join("|")，其中每个分支基座恰好是 term.pattern 的外层捕获组，
 *   因此在第 b 个分支上叠加 term 内部的捕获组后，分支 b 的基座槽位是一个确定数字。
 *   「分支 b 命中  ⇔  match[基座槽位] !== undefined」（alternation 同一时刻只有
 *   一个分支参与捕获）是稳定不变量，不依赖用户捕获组的数量、命名或排列。
 *
 *   主扫描的 RegExpExecArray 已包含完整原文上的分支捕获槽，直接读取它们
 *   不会丢失 lookbehind/lookahead 上下文。仅当主匹配的槽位异常未对齐时，
 *   才用 phaseRegex 在完整原文上重放扫描兜底。
 *
 * 快路径：传入 buildTermsMatcher 物化的 matcher（其 termList 与本调用 termList
 * 同一引用）时，槽位表与 phaseRegex 直接复用，热路径零编译（Translator 逐文本
 * 节点扫描的关键性能保障）。matcher 为空或与 termList 不一致时走慢路径现场构建，
 * 行为与旧实现完全一致。
 *
 * 兜底：无法映射到任何术语（手写外部正则与 termList 不一致等契约破坏）时，把本次
 * 命中的完整原文区间写回，绝不推进 cursor 吞掉正文。
 *
 * @param {string} text
 * @param {RegExp} regex 组合正则（g 标志）
 * @param {Array} termList
 * @param {(termEntry, fullMatch) => string} replacer
 * @param {object} [matcher] buildTermsMatcher 物化的扫描上下文
 * @returns {{ output: string, spans: Array }}
 */
function scanWithTerms(text, regex, termList, replacer, matcher) {
  if (termList.length === 0) return { output: text, spans: [] };

  let branchBaseGroups; // 分支 → 基座捕获组编号
  let branchTermIndex; // 分支 → 术语下标
  let phaseRegex;

  if (matcher && matcher.termList === termList && matcher.regex) {
    // 快路径：全部扫描上下文来自 matcher，零编译
    regex = matcher.regex;
    branchBaseGroups = matcher.branchBaseGroups;
    branchTermIndex = matcher.branchTermIndex;
    phaseRegex = matcher.phaseRegex;
  } else {
    // 慢路径：现场构建（兼容裸组合正则调用方）
    // 非全局正则无法用 exec 循环（永远停在 index 0），统一补 g
    if (!regex.global) {
      regex = new RegExp(regex.source, `${regex.flags}g`);
    }

    // 分支基座槽位表：与 buildTermsRegex 采用相同的「只物化带 pattern 的术语」规则，
    // 保证槽位计算与组合正则逐字对应。无 pattern 的术语不会进入 alternation，映射直接排除。
    branchBaseGroups = [];
    branchTermIndex = [];
    let nextBaseGroup = 1;
    for (let i = 0; i < termList.length; i++) {
      const patternSrc = termList[i]?.pattern;
      if (!patternSrc) continue;
      branchBaseGroups.push(nextBaseGroup);
      branchTermIndex.push(i);
      nextBaseGroup += countCaptureGroupsInSource(patternSrc);
    }

    // 槽位映射与 termList 严格对齐（每个术语恰好贡献一个分支）时才物化回退正则；
    // 否则无法可靠反查，直接走原文保留兜底。phaseRegex 必须继承原正则全部 flags
    //（i/m/s 等），否则外部 /gi 场景下预扫描大小写不敏感语义丢失，术语被静默放弃。
    const mappingAligned = branchBaseGroups.length === termList.length;
    phaseRegex = mappingAligned ? new RegExp(regex.source, regex.flags) : null;
  }

  // 复用共享正则/共享 matcher 时必须重置主扫描状态，保证跨调用幂等
  regex.lastIndex = 0;
  let phaseLastIndex = 0; // 预扫描已推进到的位置（与主扫描 z 状态无关）

  const spans = [];
  let result = "";
  let cursor = 0;
  let match;

  // 异常回退：主匹配的分支捕获槽位无法反查时，在完整原文上重放
  // 组合正则直到当前 start。正常热路径不会调用 phaseRegex.exec。
  const resolvePhaseTermIndex = (start, fullMatch) => {
    if (!phaseRegex) return -1;
    for (;;) {
      phaseRegex.lastIndex = phaseLastIndex;
      const token = phaseRegex.exec(text);
      if (!token) return -1;
      const idx = token.index;
      phaseLastIndex = idx + (token[0].length === 0 ? 1 : token[0].length);
      if (idx > start) return -1;
      if (idx === start) {
        if (token[0] !== fullMatch) return -1;
        for (let b = 0; b < branchBaseGroups.length; b++) {
          if (token[branchBaseGroups[b]] !== undefined) {
            return branchTermIndex[b];
          }
        }
        return -1;
      }
    }
  };

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const start = match.index;

    // 零宽命中守卫：静态层只拦"整个 pattern 纯零宽"，混合臂（如 a|(?=x)）的
    // 零宽分支仍会在运行期命中。零宽命中不消费字符，照常 replacer+span 会在
    // start===end 处凭空注入译文——直接跳过：不调 replacer、不产 span、
    // 不推进 cursor，仅手动前进 lastIndex 防 exec 死循环。
    // 已知边界（同位错过）：`(?=x)|x` on "x" 时，零宽臂赢得 alternation 优先级
    // 后 lastIndex++，同位的消费分支不再被尝试，该处替换被错过。形态为
    // "漏替换"而非"错误注入"，属"宁漏不误"设计取舍，不做代码级修复。
    if (fullMatch.length === 0) {
      regex.lastIndex++;
      continue;
    }

    let termIndex = -1;
    for (let b = 0; b < branchBaseGroups.length; b++) {
      if (match[branchBaseGroups[b]] !== undefined) {
        termIndex = branchTermIndex[b];
        break;
      }
    }
    if (termIndex === -1) {
      termIndex = resolvePhaseTermIndex(start, fullMatch);
    }

    if (termIndex === -1) {
      // 无法映射到任何术语条目（契约破坏等）：原样写回本次命中的完整原文区间并前进，
      // 严禁只推进 cursor 把正文吞掉（P1 正文丢失根因）。
      result += text.slice(cursor, start + fullMatch.length);
      cursor = start + fullMatch.length;
      continue;
    }

    const termEntry = termList[termIndex];
    const replacement = replacer(termEntry, fullMatch);
    spans.push({
      start,
      end: start + fullMatch.length,
      termKey: termEntry.key,
      value: termEntry.value,
      replacement,
    });
    result += text.slice(cursor, start) + replacement;
    cursor = start + fullMatch.length;
  }

  result += text.slice(cursor);
  return { output: result, spans };
}

/**
 * 解析术语字符串
 * @param {string} termsString
 * @returns {{
 *   terms: Array<{ key: string, value: string, pattern: string }>,
 *   invalid: Array<{ key: string, error: Error }>,
 *   diagnostics: Array<{ type: string, segmentIndex: number, segment: string, key?: string, detail: object }>,
 *   hasErrors: boolean,
 * }}
 */
export function parseTerms(termsString) {
  const terms = [];
  const invalid = [];
  const diagnostics = [];
  const seenKeys = new Map(); // key -> { value, index }，记录首个出现的段

  // 非字符串/空白串统一视为空输入
  if (typeof termsString !== "string" || termsString.trim() === "") {
    return {
      terms,
      invalid,
      diagnostics,
      hasErrors: false,
    };
  }

  const lines = termsString.split(/\n|;/); // 按换行或分号分割

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const trimmedLine = lines[lineIndex].trim();
    const segmentIndex = lineIndex + 1; // 段号（1 起），与输入原文对应
    if (!trimmedLine) continue; // 空段：静默跳过（空段不是非法段）

    const lastCommaIndex = trimmedLine.lastIndexOf(",");
    const hasComma = lastCommaIndex !== -1;
    const key = hasComma
      ? trimmedLine.substring(0, lastCommaIndex).trim()
      : trimmedLine.trim();
    const value = hasComma
      ? trimmedLine.substring(lastCommaIndex + 1).trim()
      : "";

    // 空源术语：`,value`（逗号前没有源术语）
    if (hasComma && !key) {
      diagnostics.push({
        type: "empty-source-term",
        segmentIndex,
        segment: trimmedLine,
        detail: { segment: trimmedLine, segmentIndex },
      });
      continue;
    }

    // 多余逗号：`key,`（逗号后没有译文）。
    // `key,` 视为 value="" 的保留原文合法术语（替换时保留原文并 <i> 高亮），
    // 仅作非致命提醒；不 continue，继续走后续校验并正常入表。更推荐的写法是只写 key 不加尾巴逗号。
    if (hasComma && value === "") {
      diagnostics.push({
        type: "extra-comma",
        segmentIndex,
        segment: trimmedLine,
        key,
        detail: { segment: trimmedLine, segmentIndex, key },
      });
    }

    // key 当作正则源码校验，非法则跳过并收集（保留 error 供日志/UI 提示）
    let regexError = null;
    let keyRegex = null;
    try {
      keyRegex = new RegExp(key);
    } catch (error) {
      regexError = error;
    }
    if (regexError) {
      invalid.push({ key, error: regexError });
      diagnostics.push({
        type: "invalid-regex",
        segmentIndex,
        segment: trimmedLine,
        key,
        detail: {
          segment: trimmedLine,
          segmentIndex,
          key,
          error: regexError.message,
        },
      });
      continue;
    }

    // 空匹配正则（如 a*、()、x?）：会在任意位置命中空串，替换时逐字注入译文导致文本错乱，
    // 属于致命诊断，跳过该段（合法术语仍照常应用）。
    if (keyRegex.test("")) {
      diagnostics.push({
        type: "empty-matching-pattern",
        segmentIndex,
        segment: trimmedLine,
        key,
        detail: { segment: trimmedLine, segmentIndex, key },
      });
      continue;
    }

    // 纯零宽正则（如 (?=x)、(?<=x)、\b）：整个 pattern 无任何可消费原子，在空串上
    // 不匹配（躲过上面的 empty-matching 门闸），但在非空文本上逐位置零宽命中并注入
    // 译文。属于致命诊断，跳过该段（混合臂如 a|(?=x) 含可消费原子，不在此列，
    // 其运行期零宽分支由 scanWithTerms 守卫兜底）。
    if (isZeroWidthOnlyPattern(key)) {
      diagnostics.push({
        type: "zero-width-matching-pattern",
        segmentIndex,
        segment: trimmedLine,
        key,
        detail: { segment: trimmedLine, segmentIndex, key },
      });
      continue;
    }

    // 同 key 去重与冲突映射：相同 key 只保留首次出现
    if (seenKeys.has(key)) {
      const prev = seenKeys.get(key);
      if (prev.value === value) {
        // 完全相同的映射 → 非致命重复映射
        diagnostics.push({
          type: "duplicate-mapping",
          segmentIndex,
          segment: trimmedLine,
          key,
          detail: {
            segment: trimmedLine,
            segmentIndex,
            key,
            prevIndex: prev.index,
          },
        });
      } else {
        // 同源不同译文 → 致命冲突映射
        diagnostics.push({
          type: "conflicting-mapping",
          segmentIndex,
          segment: trimmedLine,
          key,
          detail: {
            segment: trimmedLine,
            segmentIndex,
            key,
            prevIndex: prev.index,
            prevValue: prev.value,
          },
        });
      }
      continue;
    }

    // 生产匹配中，key 一律按正则源码包装为 (key)，无单词边界。
    const pattern = `(${key})`;
    const entry = { key, value, pattern };
    seenKeys.set(key, { value, index: segmentIndex });
    terms.push(entry);
  }

  // 按 key.length 降序排序（重叠 key 长词在前，避免短词抢占）
  terms.sort((a, b) => b.key.length - a.key.length);

  const hasErrors = diagnostics.some((d) => FATAL_DIAGNOSTIC_TYPES.has(d.type));

  return {
    terms,
    invalid,
    diagnostics,
    hasErrors,
  };
}

/**
 * 由解析后的术语构建组合正则（g 标志），无有效术语时返回 null
 * @param {Array|object} parsedTerms
 * @returns {RegExp|null}
 */
export function buildTermsRegex(parsedTerms) {
  const terms = toTermList(parsedTerms);
  if (terms.length === 0) return null;
  const patterns = terms.map((t) => t.pattern).filter(Boolean);
  if (patterns.length === 0) return null;
  return new RegExp(patterns.join("|"), "g");
}

/**
 * 一次物化术语扫描上下文（matcher），供热路径零编译复用。
 *
 * Translator 对每个文本节点调用一次 applyTermReplace；把组合正则、phase 回退
 * 正则、分支槽位表在规则解析时一次性物化，避免逐节点重建（每术语 1 次 new RegExp
 * 探针 + phaseRegex 编译）导致的页面级卡顿。
 *
 * 返回对象字段：
 *   - termList: 术语数组（与传入 parsed.terms 同一引用）
 *   - regex: 组合正则（g 标志）
 *   - phaseRegex: 异常回退正则（继承 regex 全部 flags；不对齐时为 null）
 *   - branchBaseGroups / branchTermIndex: 分支基座槽位表
 *   - mappingAligned: 槽位映射是否与 termList 严格对齐
 *   - flags: regex.flags
 *
 * 契约：物化后调用方不得就地变异 termList 条目的 key/pattern 字段；
 * 跨调用复用同一 matcher 是安全的（lastIndex 由 scanWithTerms 每次重置）。
 * 热更新时由调用方（Translator #parseTerms）整体重建 matcher 自然失效。
 *
 * @param {Array|object} parsedTerms
 * @returns {object|null} 无有效术语时返回 null
 */
export function buildTermsMatcher(parsedTerms) {
  const termList = toTermList(parsedTerms);
  if (termList.length === 0) return null;
  const regex = buildTermsRegex(termList);
  if (!regex) return null;

  // 分支基座槽位表：与组合正则逐字对应（只物化带 pattern 的术语）
  const branchBaseGroups = [];
  const branchTermIndex = [];
  let nextBaseGroup = 1;
  for (let i = 0; i < termList.length; i++) {
    const patternSrc = termList[i]?.pattern;
    if (!patternSrc) continue;
    branchBaseGroups.push(nextBaseGroup);
    branchTermIndex.push(i);
    nextBaseGroup += countCaptureGroupsInSource(patternSrc);
  }
  const mappingAligned = branchBaseGroups.length === termList.length;

  return {
    termList,
    regex,
    phaseRegex: mappingAligned ? new RegExp(regex.source, regex.flags) : null,
    branchBaseGroups,
    branchTermIndex,
    mappingAligned,
    flags: regex.flags,
  };
}

/**
 * 单次 replace 扫描：命中区间记录 + 自定义替换回调。
 * 第 4 参既接受裸组合正则（慢路径，现场构建槽位表，兼容既有调用方），
 * 也接受 buildTermsMatcher 物化的 matcher（快路径，热路径零编译）。
 * 对命名捕获组/嵌套捕获组 key 免疫：手动 exec 扫描 + 按术语 pattern 全量反查，
 * 不依赖 String.replace 回调的捕获组参数位置。
 * @param {string} text
 * @param {Array|object} parsedTerms
 * @param {(termEntry, fullMatch) => string} replacer
 * @param {RegExp|object} [regex] 组合正则（g 标志）或 buildTermsMatcher 物化对象
 * @returns {{ output: string, spans: Array<{ start: number, end: number, termKey: string, value: string, replacement: string }> }}
 */
export function applyTermReplace(text, parsedTerms, replacer, regex) {
  // 非字符串统一视为空输入
  if (typeof text !== "string") return { output: "", spans: [] };

  const terms = toTermList(parsedTerms);

  // matcher 快路径：termList 身份必须与本次传入 terms 一致；
  // 不一致（契约破坏）时丢弃 matcher 按传入 terms 重建，保证输出自愈正确。
  // 探测用鸭子类型（termList + exec），不用 instanceof——RegExp 子类与
  // 跨 realm 场景下 instanceof 会误判。
  if (
    regex &&
    typeof regex === "object" &&
    regex.termList &&
    regex.regex &&
    typeof regex.regex.exec === "function"
  ) {
    if (regex.termList === terms) {
      return scanWithTerms(
        text,
        regex.regex,
        terms,
        (termEntry, fullMatch) => replacer(termEntry, fullMatch),
        regex
      );
    }
    regex = undefined; // 丢弃不一致的 matcher，走下方重建
  }

  const combinedRegex = regex || buildTermsRegex(terms);
  if (!combinedRegex) return { output: text, spans: [] };

  combinedRegex.lastIndex = 0; // 内部重置 lastIndex，保证可复用

  return scanWithTerms(text, combinedRegex, terms, (termEntry, fullMatch) =>
    replacer(termEntry, fullMatch)
  );
}
