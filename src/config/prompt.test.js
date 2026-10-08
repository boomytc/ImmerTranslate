import {
  DEFAULT_BATCH_PROMPT_SLUG,
  DEFAULT_DICTIONARY_PROMPT_SLUG,
  DEFAULT_NOBATCH_PROMPT_SLUG,
  DEFAULT_SUBTITLE_PROMPT_SLUG,
  PRESET_PROMPTS,
  PROMPT_CATEGORY_BATCH_SYSTEM,
  PROMPT_CATEGORY_DICTIONARY,
  PROMPT_SLUG_NOBATCH_TRANSLATION,
  PROMPT_SLUG_DICTIONARY_EN_JA,
  PROMPT_SLUG_DICTIONARY_EN_KO,
  PROMPT_SLUG_DICTIONARY_EN_RU,
  PROMPT_SLUG_DICTIONARY_EN_VI,
  PROMPT_MODE_FOLLOW_API,
  PROMPT_MODE_GLOBAL,
  PROMPT_TEMPLATE_CATEGORIES,
  getDictionaryPromptOptions,
  getPromptDisplayName,
  getAllTranslationPromptOptions,
  getTranslationPromptDisplayName,
  normalizeCustomPrompts,
  normalizePrompt,
  removePromptReferences,
  resolveApiPromptSettings,
} from "./prompt";
import {
  API_SPE_TYPES,
  DEFAULT_API_LIST,
  defaultNobatchPromptConcise,
  defaultNobatchUserPromptConcise,
  defaultDictPrompt,
  defaultDictPromptEnJa,
  defaultDictPromptEnKo,
  defaultDictPromptEnRu,
  defaultDictPromptEnVi,
  defaultDictUserPrompt,
  defaultSubtitlePrompt,
  defaultSystemPromptJson,
} from "./api";
import { I18N, UI_LANGS } from "./i18n";

describe("prompt settings", () => {
  test("resolves default ai api prompt slugs without storing prompt text", () => {
    const api = DEFAULT_API_LIST.find((item) =>
      API_SPE_TYPES.ai.has(item.apiType)
    );

    expect(api.systemPrompt).toBe("");
    expect(api.nobatchPrompt).toBe("");
    expect(api.nobatchUserPrompt).toBe("");
    expect(api.subtitlePrompt).toBe("");
    expect(api.dictPrompt).toBe("");
    expect(api.dictUserPrompt).toBe("");

    expect(resolveApiPromptSettings(api)).toMatchObject({
      batchPromptSlug: DEFAULT_BATCH_PROMPT_SLUG,
      nobatchPromptSlug: DEFAULT_NOBATCH_PROMPT_SLUG,
      subtitlePromptSlug: DEFAULT_SUBTITLE_PROMPT_SLUG,
      dictPromptSlug: DEFAULT_DICTIONARY_PROMPT_SLUG,
      systemPrompt: defaultSystemPromptJson,
      nobatchPrompt: defaultNobatchPromptConcise,
      nobatchUserPrompt: defaultNobatchUserPromptConcise,
      subtitlePrompt: defaultSubtitlePrompt,
      dictPrompt: defaultDictPrompt,
      dictUserPrompt: defaultDictUserPrompt,
    });
  });

  test("cleans api and subtitle references when a custom prompt is deleted", () => {
    const setting = {
      transApis: [
        {
          apiSlug: "openai",
          batchPromptSlug: "prompt_deleted",
          nobatchPromptSlug: "prompt_deleted",
          subtitlePromptSlug: "prompt_deleted",
          dictPromptSlug: "prompt_deleted",
          systemPrompt: "deleted batch prompt",
          nobatchPrompt: "deleted nobatch system prompt",
          nobatchUserPrompt: "deleted nobatch user prompt",
          subtitlePrompt: "deleted subtitle prompt",
          dictPrompt: "deleted dictionary prompt",
          dictUserPrompt: "deleted dictionary user prompt",
        },
      ],
      tranboxSetting: {
        aiDictPromptSlug: "prompt_deleted",
      },
      subtitleSetting: {
        segPromptMode: PROMPT_MODE_GLOBAL,
        segPromptSlug: "prompt_deleted",
      },
    };

    const cleaned = removePromptReferences(setting, "prompt_deleted");

    expect(cleaned.transApis[0]).toMatchObject({
      batchPromptSlug: DEFAULT_BATCH_PROMPT_SLUG,
      nobatchPromptSlug: DEFAULT_NOBATCH_PROMPT_SLUG,
      subtitlePromptSlug: DEFAULT_SUBTITLE_PROMPT_SLUG,
      dictPromptSlug: DEFAULT_DICTIONARY_PROMPT_SLUG,
    });
    expect(cleaned.transApis[0]).not.toHaveProperty("systemPrompt");
    expect(cleaned.transApis[0]).not.toHaveProperty("nobatchPrompt");
    expect(cleaned.transApis[0]).not.toHaveProperty("nobatchUserPrompt");
    expect(cleaned.transApis[0]).not.toHaveProperty("subtitlePrompt");
    expect(cleaned.transApis[0]).not.toHaveProperty("dictPrompt");
    expect(cleaned.transApis[0]).not.toHaveProperty("dictUserPrompt");
    expect(cleaned.tranboxSetting).toMatchObject({
      aiDictPromptSlug: PROMPT_MODE_FOLLOW_API,
    });
    expect(cleaned.subtitleSetting).toMatchObject({
      segPromptMode: PROMPT_MODE_FOLLOW_API,
      segPromptSlug: DEFAULT_SUBTITLE_PROMPT_SLUG,
    });

    expect(resolveApiPromptSettings(cleaned.transApis[0])).toMatchObject({
      systemPrompt: defaultSystemPromptJson,
      nobatchPrompt: defaultNobatchPromptConcise,
      nobatchUserPrompt: defaultNobatchUserPromptConcise,
      subtitlePrompt: defaultSubtitlePrompt,
      dictPrompt: defaultDictPrompt,
      dictUserPrompt: defaultDictUserPrompt,
    });
  });

  test("does not infer or assign protocol for legacy custom batch prompts without protocol", () => {
    const legacyBatchPrompt = {
      slug: "prompt_legacy_batch",
      category: PROMPT_CATEGORY_BATCH_SYSTEM,
      name: "Legacy Batch Prompt",
      systemPrompt: "Legacy batch system prompt",
      userPrompt: "",
    };

    const normalized = normalizePrompt(legacyBatchPrompt);
    expect(normalized.protocol).toBeUndefined();

    const normalizedCustom = normalizeCustomPrompts([legacyBatchPrompt]);
    expect(normalizedCustom[0].protocol).toBeUndefined();

    const resolved = resolveApiPromptSettings(
      {
        apiSlug: "openai",
        batchPromptSlug: "prompt_legacy_batch",
      },
      [legacyBatchPrompt]
    );

    expect(resolved.batchProtocol).toBeUndefined();
    expect(resolved.systemPrompt).toBe("Legacy batch system prompt");
    expect(resolved.batchUserPrompt).toBe("");
  });

  test("does not read prompt id fields as prompt references", () => {
    expect(normalizePrompt({ id: "prompt_old_id" }).slug).toBe("");

    const cleaned = removePromptReferences(
      {
        transApis: [
          {
            apiSlug: "openai",
            batchPromptId: "prompt_deleted",
            nobatchPromptId: "prompt_deleted",
            subtitlePromptId: "prompt_deleted",
            dictPromptId: "prompt_deleted",
          },
        ],
        subtitleSetting: {
          segPromptMode: PROMPT_MODE_GLOBAL,
          segPromptId: "prompt_deleted",
        },
      },
      "prompt_deleted"
    );

    expect(cleaned).toEqual({
      transApis: [
        {
          apiSlug: "openai",
          batchPromptId: "prompt_deleted",
          nobatchPromptId: "prompt_deleted",
          subtitlePromptId: "prompt_deleted",
          dictPromptId: "prompt_deleted",
        },
      ],
      subtitleSetting: {
        segPromptMode: PROMPT_MODE_GLOBAL,
        segPromptId: "prompt_deleted",
      },
    });
  });

  test("keeps preset nameKey for i18n display but removes it from custom storage", () => {
    const preset = PRESET_PROMPTS[0];
    const i18n = jest.fn((key, fallback) => `${key}:${fallback}`);
    const normalized = normalizeCustomPrompts([
      {
        slug: "prompt_custom",
        category: "user prompt",
        nameKey: "custom_key",
        name: "Custom prompt",
        systemPrompt: "system",
        userPrompt: "user",
      },
    ]);

    expect(getPromptDisplayName(preset, i18n)).toBe(
      `${preset.nameKey}:${preset.name}`
    );
    expect(normalized[0]).toEqual({
      slug: "prompt_custom",
      category: "user prompt",
      name: "Custom prompt",
      systemPrompt: "system",
      userPrompt: "user",
    });
  });

  test("exposes dictionary prompt templates", () => {
    const dictionaryPrompts = getDictionaryPromptOptions(PRESET_PROMPTS);
    const expectedPrompts = [
      [DEFAULT_DICTIONARY_PROMPT_SLUG, defaultDictPrompt],
      [PROMPT_SLUG_DICTIONARY_EN_JA, defaultDictPromptEnJa],
      [PROMPT_SLUG_DICTIONARY_EN_KO, defaultDictPromptEnKo],
      [PROMPT_SLUG_DICTIONARY_EN_VI, defaultDictPromptEnVi],
      [PROMPT_SLUG_DICTIONARY_EN_RU, defaultDictPromptEnRu],
    ];

    expect(PROMPT_TEMPLATE_CATEGORIES).toContain(PROMPT_CATEGORY_DICTIONARY);
    expect(dictionaryPrompts).toHaveLength(expectedPrompts.length);
    expect(dictionaryPrompts.map(({ slug }) => slug)).toEqual(
      expectedPrompts.map(([slug]) => slug)
    );
    expect(new Set(dictionaryPrompts.map(({ slug }) => slug)).size).toBe(
      expectedPrompts.length
    );

    expectedPrompts.forEach(([slug, systemPrompt]) => {
      expect(dictionaryPrompts).toContainEqual(
        expect.objectContaining({
          slug,
          category: PROMPT_CATEGORY_DICTIONARY,
          systemPrompt,
          userPrompt: defaultDictUserPrompt,
        })
      );
    });
  });

  test.each([
    [
      DEFAULT_DICTIONARY_PROMPT_SLUG,
      "Chinese",
      "词条",
      "用于 Web 和原生用户界面的库",
    ],
    [
      PROMPT_SLUG_DICTIONARY_EN_JA,
      "Japanese",
      "見出し語",
      "Webおよびネイティブのユーザーインターフェース向けライブラリ",
    ],
    [
      PROMPT_SLUG_DICTIONARY_EN_KO,
      "Korean",
      "표제어",
      "웹 및 네이티브 사용자 인터페이스용 라이브러리",
    ],
    [
      PROMPT_SLUG_DICTIONARY_EN_VI,
      "Vietnamese",
      "Mục từ",
      "Thư viện dành cho giao diện người dùng web và native",
    ],
    [
      PROMPT_SLUG_DICTIONARY_EN_RU,
      "Russian",
      "Словарная статья",
      "Библиотека для веб-интерфейсов и нативных пользовательских интерфейсов",
    ],
  ])(
    "provides target-specific dictionary instructions for %s",
    (slug, targetLanguage, localizedHeading, translationExample) => {
      const prompt = PRESET_PROMPTS.find((item) => item.slug === slug);

      expect(prompt.systemPrompt).toContain(
        `expert English-${targetLanguage} lexicographer`
      );
      expect(prompt.systemPrompt).toContain(
        `only the ${targetLanguage} translation itself`
      );
      expect(prompt.systemPrompt).toContain(`## ${localizedHeading}:`);
      expect(prompt.systemPrompt).toContain(
        `Correct output: ${translationExample}`
      );
      expect(UI_LANGS.every(([lang]) => I18N[prompt.nameKey]?.[lang])).toBe(
        true
      );
    }
  );

  test("uses one English user prompt for every dictionary preset", () => {
    expect(defaultDictUserPrompt).toContain("## [Context] (Optional)");
    expect(defaultDictUserPrompt).toContain("Document title:");
    expect(defaultDictUserPrompt).toContain("## [Target] (Required)");
    expect(defaultDictUserPrompt).toContain(
      "choose between dictionary mode and pure translation mode"
    );
    expect(defaultDictUserPrompt).not.toContain("上下文");
    expect(defaultDictUserPrompt).not.toContain("目标文本");
  });

  test("aggregates batch and nobatch prompts with [聚合] and [单句] prefixes", () => {
    const options = getAllTranslationPromptOptions(PRESET_PROMPTS);
    expect(options.length).toBeGreaterThan(0);

    const batchItem = options.find((p) => p.isBatch);
    const nobatchItem = options.find((p) => !p.isBatch);

    expect(batchItem).toBeDefined();
    expect(nobatchItem).toBeDefined();

    expect(getTranslationPromptDisplayName(batchItem)).toMatch(/^\[聚合\]\s+/);
    expect(getTranslationPromptDisplayName(nobatchItem)).toMatch(
      /^\[单句\]\s+/
    );
  });
});
