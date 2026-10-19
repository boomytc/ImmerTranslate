import { I18N, UI_LANGS, newI18n } from "./i18n";

test("covers every supported locale for every registered label", () => {
  const locales = UI_LANGS.map(([locale]) => locale);
  const missing = Object.entries(I18N).flatMap(([key, translations]) =>
    locales
      .filter((locale) => !translations[locale])
      .map((locale) => `${key}:${locale}`)
  );

  expect(missing).toEqual([]);
});

test("tells users there is no usable translation service in the FAB empty state", () => {
  const copy = I18N.fab_no_keyed_provider;
  expect(copy.zh).toBe(
    "没有可用的翻译服务。请到接口设置启用服务，或填写密钥。"
  );
  expect(copy.en).toBe(
    "No translation service is available. Enable one in API settings, or add an API key."
  );
  expect(copy.zh).not.toContain("已填写密钥");
  expect(copy.en).not.toContain("has an API key yet");
});

test("tells users to refresh after a missing connection setup", () => {
  expect(I18N.test_connection_missing.zh).toContain("请先填写密钥和接口地址");
  expect(I18N.test_connection_missing.zh).toContain("配置后请刷新页面再译");
  expect(I18N.test_connection_missing.en).toContain(
    "Enter an API key and endpoint first."
  );
  expect(I18N.test_connection_missing.en).toContain(
    "refresh the page and translate again"
  );
  expect(I18N.test_connection_invalid_key.zh).toBe(
    "密钥无效。请核对密钥，必要时检查接口地址"
  );
  expect(I18N.test_connection_invalid_key.en).toBe(
    "The API key is invalid. Check the key, and the endpoint if needed."
  );
  expect(I18N.test_connection_network.zh).toBe(
    "网络错误，请稍后重试，或检查网络与接口地址"
  );
  expect(I18N.test_connection_network.en).toBe(
    "Network error. Try again later, or check your network and the endpoint."
  );
  expect(I18N.test_connection_http.zh).toBe(
    "连接失败，请检查接口地址或稍后重试"
  );
  expect(I18N.test_connection_http.en).toBe(
    "Connection failed. Check the endpoint or try again later"
  );
  expect(I18N.page_translate_failed.zh).toBe(
    "页面翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口"
  );
  expect(I18N.page_translate_failed.en).toBe(
    "Page translation failed. Check your network, switch translation service, or open settings and check the endpoint."
  );
  expect(I18N.page_translate_service_unavailable.zh).toBe(
    "当前翻译服务不可用或已停用。请换一个翻译服务，或打开设置检查接口"
  );
  expect(I18N.page_translate_service_unavailable.en).toBe(
    "This translation service is unavailable or turned off. Switch translation service, or open settings and check the endpoint."
  );
  expect(I18N.hover_translate_failed.zh).toBe(
    "悬停翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口"
  );
  expect(I18N.hover_translate_failed.en).toBe(
    "Hover translation failed. Check your network, switch translation service, or open settings and check the endpoint."
  );
  expect(I18N.selection_translate_failed.zh).toBe(
    "划词翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口"
  );
  expect(I18N.selection_translate_failed.en).toBe(
    "Selection translation failed. Check your network, switch translation service, or open settings and check the endpoint."
  );
  expect(I18N.input_translate_failed.zh).toBe(
    "输入框翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口"
  );
  expect(I18N.input_translate_failed.en).toBe(
    "Input box translation failed. Check your network, switch translation service, or open settings and check the endpoint."
  );
  expect(I18N.test_connection_ok.zh).toBe("已连通");
  expect(I18N.test_connection_ok_empty.zh).toBe("已连通，模型列表为空");
});

test("names the separate text window in Chinese and English", () => {
  expect(I18N.popup_open_separate_window.zh).toBe("打开独立窗");
  expect(I18N.popup_open_separate_window.en).toBe("Open separate window");
  expect(I18N.popup_text_translation.zh).toBe("文本翻译");
  expect(I18N.popup_text_translation.en).toBe("Text translation");
});

test("provides distinct popup loading and domain status labels", () => {
  expect(I18N.popup_loading.en).toBe("Loading…");
  expect(I18N.popup_loading.en).not.toBe(I18N.popup_translating.en);
  expect(I18N.popup_domain_allowed.en).toBe("Not blocked");
  expect(I18N.popup_domain_blocked.en).toBe("Blocked");
  expect(I18N.popup_domain_allowed.en).not.toBe(I18N.popup_domain_blocked.en);
  expect(I18N.popup_more_services.en).toBe("More translation services");
});

test("localizes the options playground label", () => {
  expect(I18N.playground.zh).toBe("演练场");
  expect(I18N.playground.en).toBe("Playground");
});

test("keeps the interface language list to Chinese and English", () => {
  expect(UI_LANGS.map(([locale]) => locale)).toEqual(["en", "zh"]);
});

test("uses Chinese for Chinese locale tags and English otherwise", () => {
  expect(newI18n("zh-TW")("app_name")).toBe(I18N.app_name.zh);
  expect(newI18n("ja")("app_name")).toBe(I18N.app_name.en);
});

test("provides default text when key is not found", () => {
  const i18n = newI18n("en");
  expect(i18n("nonexistent_key")).toBe("nonexistent_key");
  expect(i18n("nonexistent_key", "Fallback")).toBe("Fallback");
  expect(i18n("nonexistent_key", "")).toBe("");
  expect(i18n("app_name")).not.toBe("app_name");
});
