const $ = (id) => document.getElementById(id);

/** Defaults: DeepSeek OpenAI-compatible */
const DEFAULTS = {
  provider: "openai",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
  apiKey: "",
  sourceLang: "auto",
  targetLang: "zh-CN",
  paragraphHotkey: "Alt+T",
};

const hotkeyApi = globalThis.ImmerHotkey;

function currentHotkey() {
  return (
    hotkeyApi.normalizeHotkey($("paragraphHotkey").value) ||
    DEFAULTS.paragraphHotkey
  );
}

function normalizeProvider(value) {
  return value === "anthropic" ? "anthropic" : "openai";
}

chrome.storage.local.get(DEFAULTS, (data) => {
  $("provider").value = normalizeProvider(data.provider);
  $("baseUrl").value = data.baseUrl || DEFAULTS.baseUrl;
  $("model").value = data.model || DEFAULTS.model;
  $("apiKey").value = data.apiKey || "";
  $("sourceLang").value = data.sourceLang || DEFAULTS.sourceLang;
  $("targetLang").value = data.targetLang || DEFAULTS.targetLang;
  $("paragraphHotkey").value =
    hotkeyApi.normalizeHotkey(data.paragraphHotkey) || DEFAULTS.paragraphHotkey;
});

$("paragraphHotkey").addEventListener("keydown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const next = hotkeyApi.formatHotkeyEvent(event);
  if (!next) return;
  $("paragraphHotkey").value = next;
});

$("resetHotkey").addEventListener("click", () => {
  $("paragraphHotkey").value = DEFAULTS.paragraphHotkey;
});

$("save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      provider: normalizeProvider($("provider").value),
      baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
      model: $("model").value.trim() || DEFAULTS.model,
      apiKey: $("apiKey").value.trim(),
      sourceLang: $("sourceLang").value,
      targetLang: $("targetLang").value,
      paragraphHotkey: currentHotkey(),
    },
    () => {
      $("status").textContent = "已保存";
      setTimeout(() => {
        $("status").textContent = "";
      }, 1500);
    }
  );
});
