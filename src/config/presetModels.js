import { OPT_TRANS_APIMART, OPT_TRANS_EPHONEAI, OPT_TRANS_QWENMT } from "./api";

const PRESET_MODELS = {
  [OPT_TRANS_EPHONEAI]: [
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gemini-3.1-flash-lite-preview",
    "grok-4.20-beta-0309-non-reasoning",
  ],
  [OPT_TRANS_APIMART]: [
    "gpt-5.6-luna",
    "gpt-5.4-mini",
    "deepseek-v4-flash",
    "claude-3-5-haiku",
  ],
  [OPT_TRANS_QWENMT]: [
    "qwen-mt-flash",
    "qwen-mt-plus",
    "qwen-mt-lite",
    "qwen-mt-turbo",
  ],
};

/** Models shipped with a preset provider. Other engines come from the catalog. */
export function getPresetModels(apiType) {
  return PRESET_MODELS[apiType] || [];
}
