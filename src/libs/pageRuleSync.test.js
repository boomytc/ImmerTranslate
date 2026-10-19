import { EVENT_KISS_INNER, MSG_TRANS_CURRULE } from "../config";
import { browser } from "./browser";
import { publishPageRule } from "./pageRuleSync";

jest.mock("./client", () => ({ isExt: true }));
jest.mock("./browser", () => ({
  browser: { runtime: { sendMessage: jest.fn(() => Promise.resolve()) } },
}));

describe("page rule sync", () => {
  beforeEach(() => {
    browser.runtime.sendMessage.mockClear();
  });

  test("publishes the current rule in-page and to the toolbar popup", () => {
    const received = [];
    const onInner = (event) => received.push(event.detail);
    document.addEventListener(EVENT_KISS_INNER, onInner);
    publishPageRule({
      rule: { apiSlug: "deepl", toLang: "fr", transOpen: "true" },
      isTopFrame: true,
      document: { token: "page" },
    });
    document.removeEventListener(EVENT_KISS_INNER, onInner);

    expect(received).toEqual([
      {
        action: MSG_TRANS_CURRULE,
        rule: { apiSlug: "deepl", toLang: "fr", transOpen: "true" },
        isTopFrame: true,
        document: { token: "page" },
      },
    ]);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: MSG_TRANS_CURRULE,
      args: received[0],
    });
  });
});
