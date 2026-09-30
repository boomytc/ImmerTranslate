jest.mock("./request", () => ({
  fetchHandle: jest.fn(),
  fnPolyfill: jest.fn(),
}));

import {
  buildAnthropicModelListUrls,
  collectDashscopeModelIds,
  createModelListRequest,
  fetchModelCatalog,
  parseDashscopeModelsPage,
  parseModelCatalogResponse,
  parseModelListResponse,
  resolveOpenAIModelListUrl,
} from "./modelList";
import { fetchHandle, fnPolyfill } from "./request";
import {
  OPT_TRANS_ALIYUNBAILIAN,
  OPT_TRANS_CLAUDE,
  OPT_TRANS_GEMINI,
  OPT_TRANS_GEMINI_2,
  OPT_TRANS_OPENAI,
} from "../config/api";

describe("modelList", () => {
  test("parses OpenAI-compatible model lists", () => {
    expect(
      parseModelListResponse({
        data: [
          { id: "gpt-4o" },
          { id: "gpt-4o" },
          { id: "deepseek-chat" },
          { id: "" },
        ],
      })
    ).toEqual(["gpt-4o", "deepseek-chat"]);
  });

  test("uses OpenRouter model IDs instead of also listing display names", () => {
    expect(
      parseModelListResponse({
        data: [
          {
            id: "qwen/qwen3.7-flash",
            name: "Qwen: Qwen3.7 Flash",
          },
          {
            id: "anthropic/claude-opus-5-fast",
            name: "Claude Opus 5 (Fast)",
          },
        ],
      })
    ).toEqual(["qwen/qwen3.7-flash", "anthropic/claude-opus-5-fast"]);
  });

  test("preserves OpenRouter reasoning capabilities by model ID", () => {
    expect(
      parseModelCatalogResponse({
        data: [
          {
            id: "google/gemini-3.5-flash",
            reasoning: {
              supported_efforts: ["high", "medium", "low", "minimal"],
              default_effort: "medium",
              default_enabled: true,
              mandatory: true,
            },
          },
        ],
      })
    ).toEqual({
      models: ["google/gemini-3.5-flash"],
      thinkingCapabilities: {
        "google/gemini-3.5-flash": {
          model: "google/gemini-3.5-flash",
          supportedEfforts: ["high", "medium", "low", "minimal"],
          defaultEffort: "medium",
          defaultEnabled: true,
          mandatory: true,
        },
      },
    });
  });

  test("parses Gemini model lists", () => {
    expect(
      parseModelListResponse({
        models: [
          { name: "models/gemini-2.5-flash" },
          { baseModelId: "gemini-2.5-pro" },
        ],
      })
    ).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
  });

  test("parses Ollama-style model lists", () => {
    expect(
      parseModelListResponse({
        models: [{ name: "llama3.1" }, { name: "qwen2.5:7b" }],
      })
    ).toEqual(["llama3.1", "qwen2.5:7b"]);
  });

  test("returns an empty list for invalid responses", () => {
    expect(parseModelListResponse(null)).toEqual([]);
    expect(parseModelListResponse({ data: "invalid" })).toEqual([]);
  });

  test("builds bearer auth requests by default", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_OPENAI,
        modelListUrl: "https://api.openai.com/v1/models",
        key: "sk-test",
      })
    ).toEqual({
      input: "https://api.openai.com/v1/models",
      init: {
        method: "GET",
        headers: {
          Authorization: "Bearer sk-test",
        },
      },
    });
  });

  test("builds Gemini key query requests", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_GEMINI,
        modelListUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        key: "gemini-key",
      })
    ).toEqual({
      input:
        "https://generativelanguage.googleapis.com/v1beta/models?key=gemini-key",
      init: {
        method: "GET",
      },
    });
  });

  test("builds Gemini key query requests for native Gemini URLs regardless of apiType", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_GEMINI_2,
        modelListUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        key: "gemini-key",
      })
    ).toEqual({
      input:
        "https://generativelanguage.googleapis.com/v1beta/models?key=gemini-key",
      init: {
        method: "GET",
      },
    });
  });

  test("builds bearer auth requests for Gemini2 OpenAI-compatible model list URL", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_GEMINI_2,
        modelListUrl:
          "https://generativelanguage.googleapis.com/v1beta/openai/models",
        key: "gemini-key",
      })
    ).toEqual({
      input: "https://generativelanguage.googleapis.com/v1beta/openai/models",
      init: {
        method: "GET",
        headers: {
          Authorization: "Bearer gemini-key",
        },
      },
    });
  });

  test("builds Anthropic model list headers instead of bearer auth", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_CLAUDE,
        modelListUrl: "https://api.anthropic.com/v1/models",
        key: "sk-ant-test",
      })
    ).toEqual({
      input: "https://api.anthropic.com/v1/models",
      init: {
        method: "GET",
        headers: {
          "x-api-key": "sk-ant-test",
          "anthropic-version": "2023-06-01",
        },
      },
    });
  });

  test("tries /v1/models before /models when the Anthropic base has no /v1", () => {
    expect(buildAnthropicModelListUrls("https://api.anthropic.com")).toEqual([
      "https://api.anthropic.com/v1/models",
      "https://api.anthropic.com/models",
    ]);
    expect(
      buildAnthropicModelListUrls("https://api.anthropic.com/v1/models")
    ).toEqual(["https://api.anthropic.com/v1/models"]);
    expect(
      buildAnthropicModelListUrls("https://api.anthropic.com/v1/messages")
    ).toEqual(["https://api.anthropic.com/v1/models"]);
  });

  test("resolves OpenAI-compatible chat and base URLs to {base}/models", () => {
    expect(resolveOpenAIModelListUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/models"
    );
    expect(
      resolveOpenAIModelListUrl("https://api.openai.com/v1/chat/completions")
    ).toBe("https://api.openai.com/v1/models");
    expect(resolveOpenAIModelListUrl("https://api.deepseek.com/models")).toBe(
      "https://api.deepseek.com/models"
    );
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_OPENAI,
        modelListUrl: "https://api.deepseek.com/chat/completions",
        key: "sk-test",
      }).input
    ).toBe("https://api.deepseek.com/models");
  });

  test("uses key placeholder without extra authorization", () => {
    expect(
      createModelListRequest({
        apiType: OPT_TRANS_OPENAI,
        modelListUrl: "https://example.com/models?api_key={{key}}",
        key: "key with space",
      })
    ).toEqual({
      input: "https://example.com/models?api_key=key%20with%20space",
      init: {
        method: "GET",
      },
    });
  });
});

describe("fetchModelCatalog providers", () => {
  beforeEach(() => {
    fetchHandle.mockReset();
    fnPolyfill.mockReset();
    // react-scripts 默认 resetMocks，会清掉工厂里的实现，这里每个用例重新接上。
    fnPolyfill.mockImplementation(async ({ fn, ...args }) => fn(args));
  });

  test("falls back to /models after an Anthropic 404", async () => {
    fetchHandle
      .mockRejectedValueOnce(
        new Error(
          JSON.stringify({
            url: "https://gateway.example/v1/models",
            status: 404,
            statusText: "Not Found",
          })
        )
      )
      .mockResolvedValueOnce({
        data: [{ id: "claude-haiku" }],
      });

    const catalog = await fetchModelCatalog({
      apiType: OPT_TRANS_CLAUDE,
      modelListUrl: "https://gateway.example",
      key: "sk-ant-test",
    });

    expect(catalog.models).toEqual(["claude-haiku"]);
    expect(fetchHandle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: "https://gateway.example/v1/models",
        init: expect.objectContaining({
          headers: {
            "x-api-key": "sk-ant-test",
            "anthropic-version": "2023-06-01",
          },
        }),
      })
    );
    expect(fetchHandle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: "https://gateway.example/models",
      })
    );
  });

  test("does not fall back when the only Anthropic models URL returns 404", async () => {
    fetchHandle.mockRejectedValueOnce(
      new Error(JSON.stringify({ status: 404, statusText: "Not Found" }))
    );

    await expect(
      fetchModelCatalog({
        apiType: OPT_TRANS_CLAUDE,
        modelListUrl: "https://api.anthropic.com/v1/models",
        key: "sk-ant-test",
      })
    ).rejects.toThrow('"status":404');
    expect(fetchHandle).toHaveBeenCalledTimes(1);
  });

  test("parses DashScope output.models and pages until the catalog is complete", async () => {
    expect(
      parseDashscopeModelsPage({
        output: {
          total: 3,
          models: [
            { model: "qwen-plus" },
            { model_name: "qwen-turbo" },
            { name: "qwen-max" },
            { id: "qwen-plus" },
          ],
        },
      }).models
    ).toEqual(["qwen-plus", "qwen-turbo", "qwen-max"]);

    const ids = await collectDashscopeModelIds(
      async ({ pageNo }) => {
        if (pageNo === 1) {
          return {
            output: {
              total: 3,
              models: [{ model: "qwen-plus" }, { name: "qwen-turbo" }],
            },
          };
        }
        return {
          output: {
            total: 3,
            models: [{ id: "qwen-max" }, { model: "qwen-plus" }],
          },
        };
      },
      { pageSize: 2 }
    );
    expect(ids).toEqual(["qwen-plus", "qwen-turbo", "qwen-max"]);

    fetchHandle
      .mockResolvedValueOnce({
        output: {
          total: 2,
          models: [{ model: "qwen-plus" }],
        },
      })
      .mockResolvedValueOnce({
        output: {
          total: 2,
          models: [{ model_name: "qwen-flash" }],
        },
      });

    const catalog = await fetchModelCatalog({
      apiType: OPT_TRANS_ALIYUNBAILIAN,
      modelListUrl: "https://dashscope.aliyuncs.com/api/v1/models",
      key: "sk-dashscope",
    });

    expect(catalog.models).toEqual(["qwen-plus", "qwen-flash"]);
    expect(fetchHandle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input:
          "https://dashscope.aliyuncs.com/api/v1/models?page_no=1&page_size=100",
        init: expect.objectContaining({
          headers: { Authorization: "Bearer sk-dashscope" },
        }),
      })
    );
    expect(fetchHandle.mock.calls[1][0].input).toContain("page_no=2");
  });

  test("rewrites DashScope compatible-mode URLs onto the native catalog", async () => {
    fetchHandle.mockResolvedValueOnce({
      output: {
        total: 1,
        models: [{ model: "qwen-plus" }],
      },
    });

    const catalog = await fetchModelCatalog({
      apiType: OPT_TRANS_ALIYUNBAILIAN,
      modelListUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
      key: "sk-dashscope",
    });

    expect(catalog.models).toEqual(["qwen-plus"]);
    expect(fetchHandle.mock.calls[0][0].input).toBe(
      "https://dashscope.aliyuncs.com/api/v1/models?page_no=1&page_size=100"
    );
  });
});
