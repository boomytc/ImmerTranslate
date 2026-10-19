import {
  DEFAULT_FAB,
  FAB_MAX_SIZE,
  FAB_MIN_OPACITY,
  FAB_MIN_SIZE,
  applyFabSitePolicy,
  canonicalSiteEntry,
  isFabVisible,
  normalizeFabAppearance,
  normalizeFabConfig,
  resetFabVisibilityHold,
  restoreRemovedFabSites,
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
    expect(normalizeFabAppearance({ opacity: 0 }).opacity).toBe(
      FAB_MIN_OPACITY
    );
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

describe("normalizeFabConfig", () => {
  afterEach(() => {
    resetFabVisibilityHold();
  });

  test("fills the two site lists and appearance defaults", () => {
    expect(normalizeFabConfig(null)).toEqual(DEFAULT_FAB);
    expect(normalizeFabConfig({})).toEqual(DEFAULT_FAB);
    expect(DEFAULT_FAB).toEqual({
      isHide: false,
      hiddenSites: "",
      shownSites: "",
      halfHide: true,
      opacity: 1,
      size: 56,
    });
  });

  test("is idempotent and keeps position fields", () => {
    const once = normalizeFabConfig({
      isHide: "true",
      hiddenSites: "x.com",
      shownSites: 12,
      x: 10,
      y: 20,
      size: 48.2,
    });
    expect(once).toMatchObject({
      isHide: true,
      hiddenSites: "x.com",
      shownSites: "",
      x: 10,
      y: 20,
      size: 48,
    });
    expect(normalizeFabConfig(once)).toEqual(once);
  });

  test("drops the retired exception list instead of interpreting it", () => {
    expect(
      normalizeFabConfig({ hideExceptionList: "x.com", isHide: false })
    ).toMatchObject({
      isHide: false,
      hiddenSites: "",
      shownSites: "",
    });
    expect(
      normalizeFabConfig({ hideExceptionList: "x.com" }).hideExceptionList
    ).toBeUndefined();
  });
});

describe("isFabVisible", () => {
  describe("when the floating button is shown globally", () => {
    test("is visible when hiddenSites is empty", () => {
      expect(isFabVisible("https://example.com/test", {})).toBe(true);
      expect(isFabVisible("https://example.com/test", { isHide: false })).toBe(
        true
      );
    });

    test("is hidden when the host is listed in hiddenSites", () => {
      expect(
        isFabVisible("https://example.com/test", {
          isHide: false,
          hiddenSites: "example.com",
        })
      ).toBe(false);
    });

    test("is hidden when a wildcard matches the host, including the bare domain", () => {
      expect(
        isFabVisible("https://sub.example.com/test", {
          isHide: false,
          hiddenSites: "*.example.com",
        })
      ).toBe(false);
      expect(
        isFabVisible("https://example.com/test", {
          isHide: false,
          hiddenSites: "*.example.com",
        })
      ).toBe(false);
    });

    test("does not hide a different host that merely contains the entry text", () => {
      expect(
        isFabVisible("https://netflix.com/", {
          isHide: false,
          hiddenSites: "x.com",
        })
      ).toBe(true);
      expect(
        isFabVisible("https://github.com.cn/", {
          isHide: false,
          hiddenSites: "github.com",
        })
      ).toBe(true);
    });

    test("is visible when the host is not in hiddenSites", () => {
      expect(
        isFabVisible("https://another.org/", {
          isHide: false,
          hiddenSites: "example.com\ngoogle.com",
        })
      ).toBe(true);
    });

    test("handles comma and newline separated hiddenSites with whitespace", () => {
      const config = {
        isHide: false,
        hiddenSites: "  foo.com ,  bar.com \n  example.com  ",
      };
      expect(isFabVisible("https://example.com/", config)).toBe(false);
      expect(isFabVisible("https://bar.com/", config)).toBe(false);
      expect(isFabVisible("https://other.com/", config)).toBe(true);
    });
  });

  describe("when the floating button is hidden globally", () => {
    test("is hidden when shownSites is empty", () => {
      expect(isFabVisible("https://example.com/", { isHide: true })).toBe(
        false
      );
      expect(
        isFabVisible("https://example.com/", {
          isHide: true,
          shownSites: "",
        })
      ).toBe(false);
    });

    test("is visible when the host is listed in shownSites", () => {
      expect(
        isFabVisible("https://example.com/", {
          isHide: true,
          shownSites: "example.com",
        })
      ).toBe(true);
    });

    test("is visible when a wildcard in shownSites matches", () => {
      expect(
        isFabVisible("https://sub.example.com/page", {
          isHide: true,
          shownSites: "*.example.com",
        })
      ).toBe(true);
      expect(
        isFabVisible("https://example.com/page", {
          isHide: true,
          shownSites: "*.example.com",
        })
      ).toBe(true);
    });

    test("remains hidden when the host is not in shownSites", () => {
      expect(
        isFabVisible("https://another.com/", {
          isHide: true,
          shownSites: "example.com",
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

describe("applyFabSitePolicy", () => {
  const href = "https://x.com/home?q=1";

  test("stores the same hostname the floating menu and the popup both derive from the URL", () => {
    expect(canonicalSiteEntry(href)).toBe("x.com");
    expect(canonicalSiteEntry("https://www.example.com:8443/a")).toBe(
      "www.example.com:8443"
    );
    const fromMenu = applyFabSitePolicy(DEFAULT_FAB, href, false);
    const fromPopup = applyFabSitePolicy({ ...DEFAULT_FAB, x: 3 }, href, false);
    expect(fromMenu.hiddenSites).toBe(fromPopup.hiddenSites);
    expect(fromMenu.hiddenSites).toBe("x.com");
    expect(fromPopup.x).toBe(3);
  });

  test("keeps each list's meaning when the global switch flips", () => {
    const hiddenOnSite = applyFabSitePolicy(DEFAULT_FAB, href, false);
    expect(hiddenOnSite.isHide).toBe(false);
    expect(hiddenOnSite.hiddenSites).toBe("x.com");
    expect(hiddenOnSite.shownSites).toBe("");
    expect(isFabVisible(href, hiddenOnSite)).toBe(false);
    expect(isFabVisible("https://news.ycombinator.com/", hiddenOnSite)).toBe(
      true
    );

    const globallyHidden = { ...hiddenOnSite, isHide: true };
    expect(isFabVisible(href, globallyHidden)).toBe(false);
    expect(isFabVisible("https://news.ycombinator.com/", globallyHidden)).toBe(
      false
    );
    expect(globallyHidden.hiddenSites).toBe("x.com");
    expect(globallyHidden.shownSites).toBe("");
  });

  test("shows a globally hidden site by writing shownSites, without moving hiddenSites", () => {
    const next = applyFabSitePolicy(
      { isHide: true, hiddenSites: "news.ycombinator.com", shownSites: "" },
      href,
      true
    );
    expect(next.hiddenSites).toBe("news.ycombinator.com");
    expect(next.shownSites).toBe("x.com");
    expect(isFabVisible(href, next)).toBe(true);
    expect(isFabVisible(href, { ...next, isHide: false })).toBe(true);
  });

  test("removes every matching entry, including wildcards, with the same matcher used for visibility", () => {
    const hidden = {
      isHide: false,
      hiddenSites: "*.example.com\nkeep.org",
      shownSites: "example.com",
    };
    const shown = applyFabSitePolicy(
      hidden,
      "https://sub.example.com/page",
      true
    );
    expect(shown.hiddenSites).toBe("keep.org");
    expect(shown.shownSites).toBe("example.com");
    expect(isFabVisible("https://sub.example.com/page", shown)).toBe(true);
    expect(isFabVisible("https://example.com/", shown)).toBe(true);
  });

  test("restore puts removed wildcard entries back and keeps entries added later", () => {
    const hiddenGlobally = {
      isHide: true,
      hiddenSites: "",
      shownSites: "*\nother.example",
    };
    const href = "https://localhost/article";
    const removed = ["*"];
    const afterHide = applyFabSitePolicy(hiddenGlobally, href, false);
    expect(afterHide.shownSites).toBe("other.example");
    const duringUndo = {
      ...afterHide,
      shownSites: "other.example\nadded.example",
    };
    const restored = restoreRemovedFabSites(duringUndo, href, removed);
    expect(restored.shownSites.split("\n").sort()).toEqual(
      ["*", "added.example", "other.example"].sort()
    );
    expect(isFabVisible(href, restored)).toBe(true);
  });
});
