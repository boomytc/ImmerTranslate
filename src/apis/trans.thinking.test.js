jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
}));

jest.mock("../libs/docInfo", () => ({ getDocInfo: () => ({}) }));

import { genTransReq } from "./trans";
import {
  DEFAULT_API_LIST,
  OPT_TRANS_ALIYUNBAILIAN,
  OPT_TRANS_CLAUDE,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_OPENAI,
  OPT_TRANS_OPENROUTER,
  OPT_TRANS_SILICONFLOW,
} from "../config";

const requestBody = async (apiType, update = {}) => {
  const base = DEFAULT_API_LIST.find((api) => api.apiType === apiType);
  const [, init] = await genTransReq({
    ...base,
    key: "test-key",
    useStream: false,
    useBatchFetch: false,
    texts: ["hello"],
    from: "en",
    to: "zh-CN",
    fromLang: "en",
    toLang: "zh-CN",
    ...update,
  });
  return JSON.parse(init.body);
};

describe("applyThinkingParameters explicit off", () => {
  test("DeepSeek default and disabled bodies disable thinking without reasoning_effort", async () => {
    for (const update of [
      {},
      { thinkingMode: "disabled", thinkingEffort: null },
      { thinkingMode: "disabled", thinkingEffort: "_default" },
      { thinkingMode: "auto", thinkingEffort: "high" },
      { thinkingMode: undefined, thinkingEffort: undefined },
    ]) {
      const body = await requestBody(OPT_TRANS_DEEPSEEK, update);
      expect(body.thinking).toEqual({ type: "disabled" });
      expect(body).not.toHaveProperty("reasoning_effort");
    }
  });

  test("DeepSeek keeps an explicit enabled effort", async () => {
    const body = await requestBody(OPT_TRANS_DEEPSEEK, {
      thinkingMode: "enabled",
      thinkingEffort: "max",
    });
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.reasoning_effort).toBe("max");
  });

  test("DeepSeek enabled without a confirmed effort does not inject thinking fields", async () => {
    const body = await requestBody(OPT_TRANS_DEEPSEEK, {
      thinkingMode: "enabled",
      thinkingEffort: "_default",
    });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  test.each(["disabled", "auto"])(
    "boolean adapters write enable_thinking false for %s",
    async (thinkingMode) => {
      const body = await requestBody(OPT_TRANS_ALIYUNBAILIAN, {
        thinkingMode,
        thinkingEffort: "_default",
      });
      expect(body.enable_thinking).toBe(false);
    }
  );

  test("boolean adapters keep enable_thinking true when thinking is enabled", async () => {
    const body = await requestBody(OPT_TRANS_ALIYUNBAILIAN, {
      thinkingMode: "enabled",
      thinkingEffort: null,
    });
    expect(body.enable_thinking).toBe(true);
  });

  test.each(["disabled", "auto"])(
    "SiliconFlow turns thinking off without a budget for %s",
    async (thinkingMode) => {
      const body = await requestBody(OPT_TRANS_SILICONFLOW, {
        thinkingMode,
        thinkingEffort: "high",
      });
      expect(body.enable_thinking).toBe(false);
      expect(body).not.toHaveProperty("thinking_budget");
    }
  );

  test("SiliconFlow keeps the budget only when thinking is enabled", async () => {
    const body = await requestBody(OPT_TRANS_SILICONFLOW, {
      thinkingMode: "enabled",
      thinkingEffort: "high",
    });
    expect(body.enable_thinking).toBe(true);
    expect(body.thinking_budget).toBe(16384);
  });

  test("Claude writes an explicit disabled thinking object", async () => {
    for (const update of [
      { thinkingMode: "disabled", thinkingEffort: null },
      { thinkingMode: "disabled", thinkingEffort: "_default" },
      { thinkingMode: "auto", thinkingEffort: "high" },
    ]) {
      const body = await requestBody(OPT_TRANS_CLAUDE, {
        model: "claude-sonnet-4-6",
        ...update,
      });
      expect(body.thinking).toEqual({ type: "disabled" });
      expect(body).not.toHaveProperty("output_config");
    }
  });

  test("Claude models that cannot disable thinking use the lowest effort", async () => {
    const body = await requestBody(OPT_TRANS_CLAUDE, {
      model: "claude-mythos-5",
      thinkingMode: "disabled",
      thinkingEffort: "_default",
    });
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "low" });
  });

  test("legacy Claude models without a thinking parameter stay untouched", async () => {
    const body = await requestBody(OPT_TRANS_CLAUDE, {
      model: "claude-3-haiku-20240307",
      thinkingMode: "disabled",
      thinkingEffort: "_default",
    });
    expect(body).not.toHaveProperty("thinking");
  });

  test("OpenAI-compatible models write the explicit off effort", async () => {
    const disabled = await requestBody(OPT_TRANS_OPENAI, {
      model: "gpt-5.4",
      thinkingMode: "disabled",
      thinkingEffort: "_default",
    });
    expect(disabled.reasoning_effort).toBe("none");

    const auto = await requestBody(OPT_TRANS_OPENAI, {
      model: "gpt-5.4",
      thinkingMode: "auto",
      thinkingEffort: "high",
    });
    expect(auto.reasoning_effort).toBe("none");
  });

  test("OpenAI models that cannot disable thinking use the lowest effort", async () => {
    const body = await requestBody(OPT_TRANS_OPENAI, {
      model: "gpt-6-astra",
      thinkingMode: "auto",
    });
    expect(body.reasoning_effort).toBe("low");
    expect(body).not.toHaveProperty("temperature");
  });

  test("unknown OpenAI models do not receive an invented reasoning_effort", async () => {
    const body = await requestBody(OPT_TRANS_OPENAI, {
      model: "gpt-4",
      thinkingMode: "disabled",
      thinkingEffort: "_default",
    });
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  test("enabled OpenAI effort is preserved", async () => {
    const body = await requestBody(OPT_TRANS_OPENAI, {
      model: "gpt-5.4",
      thinkingMode: "enabled",
      thinkingEffort: "high",
    });
    expect(body.reasoning_effort).toBe("high");
  });

  test("OpenRouter reasoning is explicitly disabled instead of omitted", async () => {
    for (const update of [
      { thinkingMode: "disabled", thinkingEffort: "_default" },
      { thinkingMode: "disabled", thinkingEffort: null },
      { thinkingMode: "auto", thinkingEffort: "high" },
    ]) {
      const body = await requestBody(OPT_TRANS_OPENROUTER, {
        model: "provider/reasoning-model",
        ...update,
      });
      expect(body.reasoning).toEqual({ enabled: false });
    }
  });

  test("OpenRouter keeps a confirmed off or on effort", async () => {
    const off = await requestBody(OPT_TRANS_OPENROUTER, {
      model: "provider/reasoning-model",
      thinkingMode: "disabled",
      thinkingEffort: "none",
    });
    expect(off.reasoning).toEqual({ effort: "none" });

    const minimum = await requestBody(OPT_TRANS_OPENROUTER, {
      model: "provider/mandatory-model",
      thinkingMode: "disabled",
      thinkingEffort: "low",
    });
    expect(minimum.reasoning).toEqual({ effort: "low" });

    const on = await requestBody(OPT_TRANS_OPENROUTER, {
      model: "provider/reasoning-model",
      thinkingMode: "enabled",
      thinkingEffort: null,
    });
    expect(on.reasoning).toEqual({ enabled: true });
  });
});
