const clientState = { isExt: false };

jest.mock("./client", () => ({
  get isExt() {
    return clientState.isExt;
  },
}));

jest.mock("./msg", () => ({
  sendBgMsg: jest.fn(),
}));

const { MSG_OPEN_OPTIONS } = require("../config");
const { sendBgMsg } = require("./msg");
const { openOptionsApisPage, optionsApisHash } = require("./optionsEntry");

describe("optionsApisHash", () => {
  test.each([
    [undefined, ""],
    [null, ""],
    [{}, ""],
    [{ hash: "/rules" }, ""],
    [{ hash: "/apis" }, "#/apis"],
    [{ hash: "#/apis" }, "#/apis"],
    [{ hash: "apis" }, "#/apis"],
  ])("%j -> %s", (args, expected) => {
    expect(optionsApisHash(args)).toBe(expected);
  });
});

describe("openOptionsApisPage", () => {
  const originalPage = process.env.REACT_APP_OPTIONSPAGE;

  afterEach(() => {
    clientState.isExt = false;
    process.env.REACT_APP_OPTIONSPAGE = originalPage;
    jest.clearAllMocks();
  });

  test("extension reuses MSG_OPEN_OPTIONS and asks for the APIs tab", () => {
    openOptionsApisPage();
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_OPEN_OPTIONS, { hash: "/apis" });
  });
});
