import {
  REQUEST_CONFIG_FIELDS,
  REQUEST_CONFIG_SALT,
  buildRequestConfigPayload,
  getRequestConfigSig,
} from "./requestConfig";

const baseSetting = {
  apiSlug: "openai_test",
  apiType: "OpenAI",
  model: "model-a",
  url: "https://api.example/v1/chat/completions",
  key: "super-secret-key-value",
  temperature: 0,
  maxTokens: 20480,
  thinkingMode: "disabled",
  thinkingEffort: "_default",
  region: "",
  folderId: "",
  customHeader: "",
  customBody: "",
  reqHook: "",
  resHook: "",
  useContext: false,
  contextSize: 3,
};

describe("request config fingerprint", () => {
  test("covers the request target and output fields", () => {
    expect(REQUEST_CONFIG_FIELDS).toEqual([
      "apiSlug",
      "apiType",
      "model",
      "url",
      "temperature",
      "maxTokens",
      "thinkingMode",
      "thinkingEffort",
      "region",
      "folderId",
      "customHeader",
      "customBody",
      "reqHook",
      "resHook",
      "useContext",
      "contextSize",
    ]);
    expect(REQUEST_CONFIG_FIELDS).not.toContain("key");
  });

  test("is stable for the same config and changes when the target changes", async () => {
    const same = await getRequestConfigSig(baseSetting);
    const repeated = await getRequestConfigSig({ ...baseSetting });
    const otherModel = await getRequestConfigSig({
      ...baseSetting,
      model: "model-b",
    });
    const otherUrl = await getRequestConfigSig({
      ...baseSetting,
      url: "https://proxy.example/v1/chat/completions",
    });
    const otherSlug = await getRequestConfigSig({
      ...baseSetting,
      apiSlug: "openai_other",
    });
    const otherType = await getRequestConfigSig({
      ...baseSetting,
      apiType: "Custom",
    });

    expect(same).toHaveLength(16);
    expect(repeated).toBe(same);
    expect(otherModel).not.toBe(same);
    expect(otherUrl).not.toBe(same);
    expect(otherSlug).not.toBe(same);
    expect(otherType).not.toBe(same);
  });

  test("changes when output-affecting request fields change", async () => {
    const baseline = await getRequestConfigSig(baseSetting);
    const variants = [
      { temperature: 0.4 },
      { maxTokens: 1024 },
      { thinkingMode: "enabled" },
      { thinkingEffort: "low" },
      { region: "eastus" },
      { folderId: "b1g-folder" },
      { customHeader: '{"X-Test":"a"}' },
      { customBody: '{"top_p":0.2}' },
      { reqHook: "async () => ({ url: 'https://hook.example' })" },
      { resHook: "async () => ({ translations: [] })" },
      { useContext: true },
      { useContext: true, contextSize: 1 },
    ];

    const signatures = await Promise.all(
      variants.map((patch) => getRequestConfigSig({ ...baseSetting, ...patch }))
    );

    expect(new Set(signatures).size).toBe(variants.length);
    signatures.forEach((signature) => expect(signature).not.toBe(baseline));
  });

  test("leaves the api key out of the payload and the signature", async () => {
    const secret = "super-secret-key-value";
    const otherSecret = "another-secret-key-value";
    const embedded = {
      ...baseSetting,
      key: secret,
      url: `https://proxy.example/v1/${secret}/chat`,
      customHeader: `{"Authorization":"Bearer ${secret}"}`,
    };
    const rotated = {
      ...embedded,
      key: otherSecret,
      url: `https://proxy.example/v1/${otherSecret}/chat`,
      customHeader: `{"Authorization":"Bearer ${otherSecret}"}`,
    };
    const differentEndpoint = {
      ...baseSetting,
      key: secret,
      url: "https://other.example/v1/chat/completions",
    };

    const payload = buildRequestConfigPayload(embedded);
    expect(payload).not.toContain(secret);
    expect(buildRequestConfigPayload(rotated)).toBe(payload);
    expect(await getRequestConfigSig(embedded)).toBe(
      await getRequestConfigSig(rotated)
    );
    expect(await getRequestConfigSig(differentEndpoint)).not.toBe(
      await getRequestConfigSig(embedded)
    );
    expect(await getRequestConfigSig(baseSetting)).toBe(
      await getRequestConfigSig({ ...baseSetting, key: otherSecret })
    );
  });

  test("ignores context size while context is off", async () => {
    const disabled = await getRequestConfigSig({
      ...baseSetting,
      useContext: false,
      contextSize: 3,
    });
    const omitted = await getRequestConfigSig({
      ...baseSetting,
      useContext: undefined,
      contextSize: 9,
    });
    const enabled = await getRequestConfigSig({
      ...baseSetting,
      useContext: true,
      contextSize: 3,
    });
    const shorter = await getRequestConfigSig({
      ...baseSetting,
      useContext: true,
      contextSize: 1,
    });

    expect(omitted).toBe(disabled);
    expect(enabled).not.toBe(disabled);
    expect(shorter).not.toBe(enabled);
    expect(REQUEST_CONFIG_SALT).toBe("request-config-v1");
  });
});
