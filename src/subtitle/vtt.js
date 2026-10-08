/**
 * 将毫秒数转换为标准 VTT 时间戳格式的字符串 (HH:MM:SS.mmm)。
 *
 * @param {number} ms - 总毫秒数
 * @returns {string} - 格式化后的 VTT 时间戳字符串 (HH:MM:SS.mmm)
 */
function formatMillisecondsToTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = String(ms % 1000).padStart(3, "0");

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * 把字幕 cue 构造成标准双语 VTT。
 *
 * @param {Array<Object>} cues - 包含 start, end, text, translation 属性的字幕对象数组
 * @returns {string} - 重构后的标准 VTT 字幕文件内容文本
 */
export function buildBilingualVtt(cues) {
  if (!Array.isArray(cues)) {
    return "WEBVTT";
  }

  const header = "WEBVTT";

  // 将每一项字幕数据转换为标准的 VTT 字幕块格式
  const cueBlocks = cues.map((cue, index) => {
    const startTime = formatMillisecondsToTimestamp(cue.start);
    const endTime = formatMillisecondsToTimestamp(cue.end);

    const cueIndex = index + 1; // 字幕块序号从 1 开始
    const timestampLine = `${startTime} --> ${endTime}`;

    const textLine = cue.text || "";
    const translationLine = cue.translation || "";

    // 每一块按: 序号 \n 时间轴 \n 原文 \n 译文 结构拼接
    return `${cueIndex}\n${timestampLine}\n${textLine}\n${translationLine}`;
  });

  // 使用双换行符拼接文件头和各个字幕块
  return [header, ...cueBlocks].join("\n\n");
}

/**
 * 把字幕 cue 构造成仅含译文的 VTT。
 * 译文缺失时回退为原文，避免生成空白字幕行。
 *
 * @param {Array<Object>} cues - 包含 start, end, text, translation 属性的字幕对象数组
 * @returns {string} - 仅含译文的标准 VTT 字幕文件内容文本
 */
export function buildTranslationOnlyVtt(cues) {
  if (!Array.isArray(cues)) {
    return "WEBVTT";
  }

  const header = "WEBVTT";

  const cueBlocks = cues.map((cue, index) => {
    const startTime = formatMillisecondsToTimestamp(cue.start);
    const endTime = formatMillisecondsToTimestamp(cue.end);

    const cueIndex = index + 1;
    const timestampLine = `${startTime} --> ${endTime}`;
    const textLine = cue.translation || cue.text || "";

    return `${cueIndex}\n${timestampLine}\n${textLine}`;
  });

  return [header, ...cueBlocks].join("\n\n");
}
