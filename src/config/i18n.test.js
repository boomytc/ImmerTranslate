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
  expect(I18N.popup_domain_allowed.en).not.toBe(I18N.popup_domain_active.en);
  expect(I18N.popup_more_services.en).toBe("More translation services");
});

test("localizes the options playground label", () => {
  expect(I18N.playground.zh).toBe("演练场");
  expect(I18N.playground.en).toBe("Playground");
  expect(I18N.playground.zh_TW).toBe("演練場");
  expect(I18N.playground.ru).toBe("Песочница");
});

test("integrates Russian translations with M3 labels and product identity", () => {
  expect(UI_LANGS.map(([locale]) => locale)).toContain("ru");
  expect(I18N.app_name.ru).toBe("ImmerTranslate");
  expect(I18N.translate.ru).toBe("Перевести");
  expect(I18N.discard_api_changes_confirm.ru).toBe(
    I18N.discard_api_changes_confirm.en
  );
});

test("provides default text when key is not found", () => {
  const i18n = newI18n("en");
  expect(i18n("nonexistent_key")).toBe("nonexistent_key");
  expect(i18n("nonexistent_key", "Fallback")).toBe("Fallback");
  expect(i18n("nonexistent_key", "")).toBe("");
  expect(i18n("app_name")).not.toBe("app_name");
});
