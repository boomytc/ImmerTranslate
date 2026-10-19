import { undoTranboxTransOpen } from "./confirmPageAction";

describe("undoTranboxTransOpen", () => {
  test("reverts only transOpen while it still matches this write", () => {
    const undo = undoTranboxTransOpen(true, false);
    expect(
      undo({
        darkMode: "light",
        tranboxSetting: { transOpen: false, blacklist: "*.example.com" },
      })
    ).toEqual({
      tranboxSetting: { transOpen: true, blacklist: "*.example.com" },
    });
  });

  test("leaves the setting alone when transOpen already changed", () => {
    const undo = undoTranboxTransOpen(true, false);
    expect(
      undo({
        tranboxSetting: { transOpen: true, blacklist: "other.com" },
      })
    ).toEqual({});
  });
});
