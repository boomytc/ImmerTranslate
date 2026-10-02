import { fetchModelCatalog } from "./modelList";
import { testApiConnection } from "./testConnection";

jest.mock("./modelList", () => ({
  fetchModelCatalog: jest.fn(),
  httpStatusFromError: jest.requireActual("./modelList").httpStatusFromError,
}));

const SECRET = "sk-deepseek-secret";

describe("testApiConnection", () => {
  beforeEach(() => {
    fetchModelCatalog.mockReset();
  });

  test("treats a missing DeepSeek key as a config failure without echoing it", async () => {
    fetchModelCatalog.mockResolvedValue({
      models: [],
      thinkingCapabilities: {},
    });

    const result = await testApiConnection({
      apiType: "DeepSeek",
      modelListUrl: "https://api.deepseek.com/models",
      key: "",
    });

    expect(fetchModelCatalog).toHaveBeenCalledWith({
      apiType: "DeepSeek",
      modelListUrl: "https://api.deepseek.com/models",
      key: "",
    });
    expect(result).toEqual({
      ok: false,
      kind: "config",
      message: "test_connection_missing",
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  test("treats a missing endpoint as a config failure", async () => {
    fetchModelCatalog.mockResolvedValue({ models: [] });

    await expect(
      testApiConnection({
        apiType: "DeepSeek",
        modelListUrl: "  ",
        key: SECRET,
      })
    ).resolves.toMatchObject({ ok: false, kind: "config" });
    expect(JSON.stringify(fetchModelCatalog.mock.calls)).not.toContain(
      "chat/completions"
    );
  });

  test("accepts an empty model catalog as a successful connection", async () => {
    fetchModelCatalog.mockResolvedValue({
      models: [],
      thinkingCapabilities: {},
    });

    await expect(
      testApiConnection({
        apiType: "DeepSeek",
        modelListUrl: "https://api.deepseek.com/models",
        key: SECRET,
      })
    ).resolves.toEqual({ ok: true, models: [] });
  });

  test("returns model ids from a parseable catalog", async () => {
    fetchModelCatalog.mockResolvedValue({
      models: ["deepseek-v4-flash", 12, "deepseek-chat"],
      thinkingCapabilities: { "deepseek-chat": { model: "deepseek-chat" } },
    });

    const result = await testApiConnection({
      apiType: "DeepSeek",
      modelListUrl: "https://api.deepseek.com/models",
      key: SECRET,
    });

    expect(result).toEqual({
      ok: true,
      models: ["deepseek-v4-flash", "deepseek-chat"],
    });
    expect(result).not.toHaveProperty("thinkingCapabilities");
  });

  test("maps 401 and 403 to an invalid key without copying the response", async () => {
    fetchModelCatalog.mockRejectedValue(
      new Error(
        JSON.stringify({
          url: `https://api.deepseek.com/models?key=${SECRET}`,
          status: 401,
          statusText: "Unauthorized",
          response: { error: { message: SECRET } },
        })
      )
    );

    const result = await testApiConnection({
      apiType: "DeepSeek",
      modelListUrl: "https://api.deepseek.com/models",
      key: SECRET,
    });

    expect(result).toEqual({
      ok: false,
      kind: "http",
      status: 401,
      message: "test_connection_invalid_key",
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  test("keeps other HTTP failures free of the response body", async () => {
    fetchModelCatalog.mockRejectedValue(
      new Error(
        JSON.stringify({
          status: 500,
          response: { error: SECRET },
        })
      )
    );

    await expect(
      testApiConnection({
        apiType: "DeepSeek",
        modelListUrl: "https://api.deepseek.com/models",
        key: SECRET,
      })
    ).resolves.toEqual({
      ok: false,
      kind: "http",
      status: 500,
      message: "test_connection_http",
    });
  });

  test("classifies a thrown error without a status as a network failure", async () => {
    fetchModelCatalog.mockRejectedValue(new Error("Failed to fetch"));

    await expect(
      testApiConnection({
        apiType: "DeepSeek",
        modelListUrl: "https://api.deepseek.com/models",
        key: SECRET,
      })
    ).resolves.toEqual({
      ok: false,
      kind: "network",
      message: "test_connection_network",
    });
  });

  test("rejects a 2xx payload that is not a model catalog", async () => {
    fetchModelCatalog.mockResolvedValue({ unexpected: true });

    await expect(
      testApiConnection({
        apiType: "DeepSeek",
        modelListUrl: "https://api.deepseek.com/models",
        key: SECRET,
      })
    ).resolves.toEqual({
      ok: false,
      kind: "provider",
      message: "test_connection_unparseable",
    });
  });

  describe("BuiltinAI connection test", () => {
    const originalTranslator = globalThis.Translator;

    afterEach(() => {
      globalThis.Translator = originalTranslator;
    });

    test("returns unavailable when Translator is missing from environment", async () => {
      delete globalThis.Translator;

      const result = await testApiConnection({ apiType: "BuiltinAI" });
      expect(result).toEqual({
        ok: false,
        kind: "builtin",
        availability: "unavailable",
        message: "builtin_ai_status_unavailable",
      });
    });

    test("returns readily when Translator.availability resolves to readily", async () => {
      const mockAvailability = jest.fn().mockResolvedValue("readily");
      globalThis.Translator = { availability: mockAvailability };

      const result = await testApiConnection({ apiType: "BuiltinAI" });
      expect(mockAvailability).toHaveBeenCalledWith({
        sourceLanguage: "en",
        targetLanguage: "zh",
      });
      expect(result).toEqual({
        ok: true,
        kind: "builtin",
        availability: "readily",
        message: "builtin_ai_status_readily",
      });
    });

    test("returns after-download when Translator.availability resolves to after-download", async () => {
      const mockAvailability = jest.fn().mockResolvedValue("after-download");
      globalThis.Translator = { availability: mockAvailability };

      const result = await testApiConnection({ apiType: "BuiltinAI" });
      expect(mockAvailability).toHaveBeenCalledWith({
        sourceLanguage: "en",
        targetLanguage: "zh",
      });
      expect(result).toEqual({
        ok: true,
        kind: "builtin",
        availability: "after-download",
        message: "builtin_ai_status_after_download",
      });
    });

    test("returns unavailable when Translator.availability resolves to unavailable", async () => {
      const mockAvailability = jest.fn().mockResolvedValue("unavailable");
      globalThis.Translator = { availability: mockAvailability };

      const result = await testApiConnection({ apiType: "BuiltinAI" });
      expect(result).toEqual({
        ok: false,
        kind: "builtin",
        availability: "unavailable",
        message: "builtin_ai_status_unavailable",
      });
    });

    test("returns readily when Translator.availability resolves to available (WICG standard)", async () => {
      const mockAvailability = jest.fn().mockResolvedValue("available");
      globalThis.Translator = { availability: mockAvailability };

      const result = await testApiConnection({ apiSlug: "BuiltinAI" });
      expect(result).toEqual({
        ok: true,
        kind: "builtin",
        availability: "readily",
        message: "builtin_ai_status_readily",
      });
    });

    test("returns after-download when Translator.availability resolves to downloadable or downloading (WICG standard)", async () => {
      globalThis.Translator = {
        availability: jest.fn().mockResolvedValue("downloadable"),
      };

      const result1 = await testApiConnection({ apiType: "BuiltinAI" });
      expect(result1).toEqual({
        ok: true,
        kind: "builtin",
        availability: "after-download",
        message: "builtin_ai_status_after_download",
      });

      globalThis.Translator = {
        availability: jest.fn().mockResolvedValue("downloading"),
      };

      const result2 = await testApiConnection({ apiType: "BuiltinAI" });
      expect(result2).toEqual({
        ok: true,
        kind: "builtin",
        availability: "after-download",
        message: "builtin_ai_status_after_download",
      });
    });

    test("returns unavailable when Translator.availability throws an error", async () => {
      globalThis.Translator = {
        availability: jest.fn().mockRejectedValue(new Error("API disabled")),
      };

      const result = await testApiConnection({ apiType: "BuiltinAI" });
      expect(result).toEqual({
        ok: false,
        kind: "builtin",
        availability: "unavailable",
        message: "builtin_ai_status_unavailable",
      });
    });
  });
});
