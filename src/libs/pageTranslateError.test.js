import {
  HOVER_TRANSLATE_FAILED,
  PAGE_TRANSLATE_FAILED,
  PAGE_TRANSLATE_HTTP,
  PAGE_TRANSLATE_INVALID_KEY,
  PAGE_TRANSLATE_NETWORK,
  PAGE_TRANSLATE_SERVICE,
  hoverTranslateFailureKey,
  pageTranslateFailureKey,
} from "./pageTranslateError";

describe("pageTranslateFailureKey", () => {
  test("maps offline and fetch failures to the connection-test network copy", () => {
    expect(pageTranslateFailureKey(new TypeError("Failed to fetch"))).toBe(
      PAGE_TRANSLATE_NETWORK
    );
    expect(
      pageTranslateFailureKey(
        new Error("NetworkError when attempting to fetch resource.")
      )
    ).toBe(PAGE_TRANSLATE_NETWORK);
    expect(
      pageTranslateFailureKey(new Error("net::ERR_INTERNET_DISCONNECTED"))
    ).toBe(PAGE_TRANSLATE_NETWORK);
    expect(pageTranslateFailureKey(new Error("GM request timeout."))).toBe(
      PAGE_TRANSLATE_NETWORK
    );
    expect(
      pageTranslateFailureKey(new Error(JSON.stringify({ status: 0 })))
    ).toBe(PAGE_TRANSLATE_NETWORK);
  });

  test("maps provider HTTP errors to the connection-test http copy", () => {
    expect(
      pageTranslateFailureKey(
        new Error(JSON.stringify({ status: 500, statusText: "Error" }))
      )
    ).toBe(PAGE_TRANSLATE_HTTP);
    expect(
      pageTranslateFailureKey(new Error(JSON.stringify({ status: 404 })))
    ).toBe(PAGE_TRANSLATE_HTTP);
    expect(pageTranslateFailureKey({ status: 502 })).toBe(PAGE_TRANSLATE_HTTP);
  });

  test("maps invalid keys to the connection-test invalid-key copy", () => {
    expect(
      pageTranslateFailureKey(new Error(JSON.stringify({ status: 401 })))
    ).toBe(PAGE_TRANSLATE_INVALID_KEY);
    expect(
      pageTranslateFailureKey(new Error(JSON.stringify({ status: 403 })))
    ).toBe(PAGE_TRANSLATE_INVALID_KEY);
    expect(pageTranslateFailureKey(new Error("invalid api key"))).toBe(
      PAGE_TRANSLATE_INVALID_KEY
    );
    expect(
      pageTranslateFailureKey(
        new Error(
          JSON.stringify({
            status: 400,
            response: { error: { message: "invalid_api_key" } },
          })
        )
      )
    ).toBe(PAGE_TRANSLATE_INVALID_KEY);
  });

  test("maps a disabled or empty service to its own actionable copy", () => {
    expect(
      pageTranslateFailureKey(new Error("translate got empty response"), {
        isDisabled: true,
      })
    ).toBe(PAGE_TRANSLATE_SERVICE);
    expect(pageTranslateFailureKey(new Error("genInit: url is empty"))).toBe(
      PAGE_TRANSLATE_SERVICE
    );
    expect(
      pageTranslateFailureKey(
        new Error("parse translate result: apiType not matched")
      )
    ).toBe(PAGE_TRANSLATE_SERVICE);
  });

  test("keeps a network code when a disabled service cannot connect", () => {
    expect(
      pageTranslateFailureKey(new TypeError("Failed to fetch"), {
        isDisabled: true,
      })
    ).toBe(PAGE_TRANSLATE_NETWORK);
  });

  test("uses an actionable page-translate fallback for unknown failures", () => {
    expect(
      pageTranslateFailureKey(new Error("translate got an unexpected result"))
    ).toBe(PAGE_TRANSLATE_FAILED);
  });
});

describe("hoverTranslateFailureKey", () => {
  test("reuses connection-test and service copy for the same failure kinds", () => {
    expect(hoverTranslateFailureKey(new TypeError("Failed to fetch"))).toBe(
      PAGE_TRANSLATE_NETWORK
    );
    expect(hoverTranslateFailureKey({ status: 502 })).toBe(PAGE_TRANSLATE_HTTP);
    expect(hoverTranslateFailureKey(new Error("invalid api key"))).toBe(
      PAGE_TRANSLATE_INVALID_KEY
    );
    expect(hoverTranslateFailureKey(new Error("genInit: url is empty"))).toBe(
      PAGE_TRANSLATE_SERVICE
    );
    expect(
      hoverTranslateFailureKey(new TypeError("Failed to fetch"), {
        isDisabled: true,
      })
    ).toBe(PAGE_TRANSLATE_NETWORK);
  });

  test("uses hover wording only for an unknown failure", () => {
    expect(
      hoverTranslateFailureKey(new Error("translate got an unexpected result"))
    ).toBe(HOVER_TRANSLATE_FAILED);
  });
});
