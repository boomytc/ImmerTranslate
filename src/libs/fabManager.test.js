jest.mock("../views/Action/ContentFab", () => () => null);
import { FabManager } from "./fabManager";

describe("FabManager", () => {
  let showSpy;

  beforeEach(() => {
    showSpy = jest.spyOn(FabManager.prototype, "show").mockImplementation(() => {});
  });

  afterEach(() => {
    showSpy.mockRestore();
  });

  test("automatically shows when autoShow is true and fab is not hidden", () => {
    new FabManager({
      processActions: jest.fn(),
      fabConfig: { isHide: false },
      autoShow: true,
    });

    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  test("does not show when fab is marked as hidden", () => {
    new FabManager({
      processActions: jest.fn(),
      fabConfig: { isHide: true },
      autoShow: true,
    });

    expect(showSpy).not.toHaveBeenCalled();
  });

  test("does not show when autoShow is false even if fab is not hidden", () => {
    new FabManager({
      processActions: jest.fn(),
      fabConfig: { isHide: false },
      autoShow: false,
    });

    expect(showSpy).not.toHaveBeenCalled();
  });

  test("shows when global is hidden but current site is in hideExceptionList", () => {
    new FabManager({
      processActions: jest.fn(),
      fabConfig: { isHide: true, hideExceptionList: "example.com" },
      autoShow: true,
      href: "https://example.com/page",
    });

    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  test("does not show when global is shown but current site is in hideExceptionList", () => {
    new FabManager({
      processActions: jest.fn(),
      fabConfig: { isHide: false, hideExceptionList: "example.com" },
      autoShow: true,
      href: "https://example.com/page",
    });

    expect(showSpy).not.toHaveBeenCalled();
  });
});
