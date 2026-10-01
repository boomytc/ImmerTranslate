import {
  DEFAULT_FAB,
  FAB_MAX_SIZE,
  FAB_MIN_OPACITY,
  FAB_MIN_SIZE,
  isFabVisible,
  normalizeFabAppearance,
} from "./fab";

describe("normalizeFabAppearance", () => {
  test("returns defaults when given null, undefined, or empty object", () => {
    expect(normalizeFabAppearance(null)).toEqual({
      halfHide: DEFAULT_FAB.halfHide,
      opacity: DEFAULT_FAB.opacity,
      size: DEFAULT_FAB.size,
    });
    expect(normalizeFabAppearance({})).toEqual({
      halfHide: DEFAULT_FAB.halfHide,
      opacity: DEFAULT_FAB.opacity,
      size: DEFAULT_FAB.size,
    });
  });

  test("clamps size to [FAB_MIN_SIZE, FAB_MAX_SIZE] and rounds", () => {
    expect(normalizeFabAppearance({ size: 10 }).size).toBe(FAB_MIN_SIZE);
    expect(normalizeFabAppearance({ size: 200 }).size).toBe(FAB_MAX_SIZE);
    expect(normalizeFabAppearance({ size: 48.4 }).size).toBe(48);
    expect(normalizeFabAppearance({ size: NaN }).size).toBe(DEFAULT_FAB.size);
  });

  test("clamps opacity to [FAB_MIN_OPACITY, 1]", () => {
    expect(normalizeFabAppearance({ opacity: 0 }).opacity).toBe(FAB_MIN_OPACITY);
    expect(normalizeFabAppearance({ opacity: 2 }).opacity).toBe(1);
    expect(normalizeFabAppearance({ opacity: 0.5 }).opacity).toBe(0.5);
    expect(normalizeFabAppearance({ opacity: undefined }).opacity).toBe(
      DEFAULT_FAB.opacity
    );
  });

  test("preserves valid boolean halfHide", () => {
    expect(normalizeFabAppearance({ halfHide: false }).halfHide).toBe(false);
    expect(normalizeFabAppearance({ halfHide: true }).halfHide).toBe(true);
    expect(normalizeFabAppearance({ halfHide: "invalid" }).halfHide).toBe(
      DEFAULT_FAB.halfHide
    );
  });
});

describe("isFabVisible", () => {
  describe("when global FAB is enabled (isHide is false or omitted)", () => {
    test("is visible when exception list is empty", () => {
      expect(isFabVisible("https://example.com/test", {})).toBe(true);
      expect(isFabVisible("https://example.com/test", { isHide: false })).toBe(
        true
      );
    });

    test("is hidden when site matches exception list", () => {
      expect(
        isFabVisible("https://example.com/test", {
          isHide: false,
          hideExceptionList: "example.com",
        })
      ).toBe(false);
    });

    test("is hidden when site matches wildcard exception (*.example.com)", () => {
      expect(
        isFabVisible("https://sub.example.com/test", {
          isHide: false,
          hideExceptionList: "*.example.com",
        })
      ).toBe(false);
    });

    test("is visible when site does not match exception list", () => {
      expect(
        isFabVisible("https://another.org/", {
          isHide: false,
          hideExceptionList: "example.com\ngoogle.com",
        })
      ).toBe(true);
    });

    test("handles comma and newline separated exception list with whitespace", () => {
      const config = {
        isHide: false,
        hideExceptionList: "  foo.com ,  bar.com \n  example.com  ",
      };
      expect(isFabVisible("https://example.com/", config)).toBe(false);
      expect(isFabVisible("https://bar.com/", config)).toBe(false);
      expect(isFabVisible("https://other.com/", config)).toBe(true);
    });
  });

  describe("when global FAB is disabled (isHide: true)", () => {
    test("is hidden when exception list is empty", () => {
      expect(isFabVisible("https://example.com/", { isHide: true })).toBe(
        false
      );
      expect(
        isFabVisible("https://example.com/", {
          isHide: true,
          hideExceptionList: "",
        })
      ).toBe(false);
    });

    test("is visible when site is explicitly in exception list (whitelist)", () => {
      expect(
        isFabVisible("https://example.com/", {
          isHide: true,
          hideExceptionList: "example.com",
        })
      ).toBe(true);
    });

    test("is visible when site matches wildcard in exception list", () => {
      expect(
        isFabVisible("https://sub.example.com/page", {
          isHide: true,
          hideExceptionList: "*.example.com",
        })
      ).toBe(true);
    });

    test("remains hidden when site is not in exception list", () => {
      expect(
        isFabVisible("https://another.com/", {
          isHide: true,
          hideExceptionList: "example.com",
        })
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles empty href gracefully", () => {
      expect(isFabVisible("", { isHide: false })).toBe(true);
      expect(isFabVisible("", { isHide: true })).toBe(false);
    });

    test("handles non-string href", () => {
      expect(isFabVisible(null, { isHide: false })).toBe(true);
      expect(isFabVisible(undefined, { isHide: true })).toBe(false);
    });
  });
});
