import {
  DEFAULT_INPUT_RULE,
  DEFAULT_MOUSE_HOVER_SETTING,
  DEFAULT_SETTING,
  DEFAULT_SUBRULES_LIST,
  DEFAULT_SUBTITLE_SETTING,
  DEFAULT_TRANBOX_SETTING,
  OPT_INPUT_DOT_ALWAYS,
  OPT_INPUT_DOT_DISABLE,
  OPT_INPUT_DOT_MOBILE,
  migrateInputRuleShowDot,
} from "./setting";
import { DEFAULT_API_LIST, OPT_TRANS_MICROSOFT } from "./api";
import { BUILTIN_RULES, GLOBAL_KEY } from "./rules";

describe("translation box defaults", () => {
  test("translates language variants by default", () => {
    expect(DEFAULT_SETTING.translateVariants).toBe(true);
  });

  test("does not convert LaTeX in translations by default", () => {
    expect(DEFAULT_SETTING.parseLatex).toBe(false);
  });

  test("does not read the clipboard automatically by default", () => {
    expect(DEFAULT_SETTING.autoTranslateClipboard).toBe(false);
  });

  test("shows the input translation dot on desktop by default", () => {
    expect(DEFAULT_INPUT_RULE.showDot).toBe(OPT_INPUT_DOT_ALWAYS);
    expect(DEFAULT_SETTING.inputRule.showDot).toBe(OPT_INPUT_DOT_ALWAYS);
  });

  test("upgrades an unmarked mobile input dot and keeps explicit choices", () => {
    expect(migrateInputRuleShowDot({ showDot: OPT_INPUT_DOT_MOBILE })).toEqual({
      showDot: OPT_INPUT_DOT_ALWAYS,
    });
    expect(
      migrateInputRuleShowDot({
        showDot: OPT_INPUT_DOT_MOBILE,
        toLang: "zh-CN",
      })
    ).toEqual({ showDot: OPT_INPUT_DOT_ALWAYS, toLang: "zh-CN" });
    expect(migrateInputRuleShowDot({ toLang: "ja" }).showDot).toBe(
      OPT_INPUT_DOT_ALWAYS
    );
    expect(migrateInputRuleShowDot({ showDot: "" }).showDot).toBe(
      OPT_INPUT_DOT_ALWAYS
    );

    const disabled = { showDot: OPT_INPUT_DOT_DISABLE, toLang: "zh-CN" };
    expect(migrateInputRuleShowDot(disabled)).toBe(disabled);
    const chosenMobile = {
      showDot: OPT_INPUT_DOT_MOBILE,
      showDotChosen: true,
      toLang: "en",
    };
    expect(migrateInputRuleShowDot(chosenMobile)).toBe(chosenMobile);
    const always = { showDot: OPT_INPUT_DOT_ALWAYS };
    expect(migrateInputRuleShowDot(always)).toBe(always);
    const unknown = { showDot: "custom" };
    expect(migrateInputRuleShowDot(unknown)).toBe(unknown);
  });

  test("uses Microsoft for every default translation entry point", () => {
    expect(DEFAULT_INPUT_RULE.apiSlug).toBe(OPT_TRANS_MICROSOFT);
    expect(DEFAULT_TRANBOX_SETTING.apiSlugs).toEqual([OPT_TRANS_MICROSOFT]);
    expect(DEFAULT_SUBTITLE_SETTING.apiSlug).toBe(OPT_TRANS_MICROSOFT);
  });

  test("does not ignore any language by default", () => {
    expect(DEFAULT_TRANBOX_SETTING.skipLangs).toEqual([]);
  });

  test("does not remember the subtitle position by default", () => {
    expect(DEFAULT_SUBTITLE_SETTING.rememberPosition).toBe(false);
    expect(DEFAULT_SUBTITLE_SETTING.positionRatio).toBe(0.05);
  });

  test("follows the current page rule for hover bubbles by default", () => {
    expect(DEFAULT_MOUSE_HOVER_SETTING.apiSlug).toBe(GLOBAL_KEY);
  });

  test("includes every current API without legacy deletion markers", () => {
    expect(DEFAULT_SETTING.transApis).toBe(DEFAULT_API_LIST);
    expect(DEFAULT_SETTING).not.toHaveProperty("deletedTransApiSlugs");
  });

  test("keeps the default subscription rules URL as the site match source", () => {
    const selected = DEFAULT_SUBRULES_LIST.find((item) => item.selected);
    expect(selected.url).toMatch(/kiss-rules_v2\.json$/);
    const patterns = BUILTIN_RULES.map((rule) => rule.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining([
        "en.wikipedia.org",
        "twitter.com, https://x.com",
        "www.youtube.com",
      ])
    );
  });
});
