const { getCacheDigest } = require("./cacheDigest");

describe("getCacheDigest", () => {
  test("returns a stable local hash that changes with the salt", () => {
    const digest = getCacheDigest("text", "salt");

    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    expect(getCacheDigest("text", "salt")).toBe(digest);
    expect(getCacheDigest("text", "other-salt")).not.toBe(digest);
  });
});
