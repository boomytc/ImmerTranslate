/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  CURRENT_SETTINGS_VERSION,
  DEFAULT_SETTING,
  OPT_INPUT_DOT_MOBILE,
} from "../config";
import { SettingProvider, useSetting } from "./Setting";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdate = jest.fn();
let mockSetting;
jest.mock("./Storage", () => ({
  useStorage: () => ({
    data: mockSetting,
    isLoading: false,
    update: mockUpdate,
    reload: jest.fn(),
  }),
}));
jest.mock("../libs/client", () => ({ isExt: false }));
jest.mock("../libs/browser", () => ({}));
jest.mock("../libs/msg", () => ({ sendBgMsg: jest.fn() }));

describe("settings persistence results", () => {
  let container;
  let root;
  let settings;

  function Probe() {
    settings = useSetting();
    return null;
  }

  function mountProvider() {
    act(() =>
      root.render(
        <SettingProvider context="popup">
          <Probe />
        </SettingProvider>
      )
    );
  }

  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ changed: true });
    mockSetting = { ...DEFAULT_SETTING, version: CURRENT_SETTINGS_VERSION };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mountProvider();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("returns the actual update promise and preserves a persistence rejection", async () => {
    const error = new Error("Settings could not be saved");
    const pending = Promise.reject(error);
    mockUpdate.mockReturnValueOnce(pending);

    const result = settings.updateSetting({ darkMode: "dark" });

    expect(result).toBe(pending);
    await expect(result).rejects.toBe(error);
  });

  test("returns the child update promise and rebases only the captured patch", () => {
    const pending = Promise.resolve({ changed: true });
    mockUpdate.mockReturnValueOnce(pending);
    const patch = { singleWordNoTrans: true };

    expect(settings.updateChild("tranboxSetting")(patch)).toBe(pending);
    patch.singleWordNoTrans = false;
    const reduce = mockUpdate.mock.calls[0][0];
    const previous = { tranboxSetting: { width: 600 }, uiLang: "en" };

    expect(reduce(previous)).toMatchObject({
      tranboxSetting: { width: 600, singleWordNoTrans: true },
      uiLang: "en",
    });
    expect(previous.tranboxSetting).toEqual({ width: 600 });
  });

  test("persists a mobile input dot choice", () => {
    mockSetting = {
      ...DEFAULT_SETTING,
      inputRule: {
        ...DEFAULT_SETTING.inputRule,
        showDot: OPT_INPUT_DOT_MOBILE,
      },
    };
    mountProvider();
    mockUpdate.mockReturnValueOnce(Promise.resolve({ changed: true }));

    settings.updateChild("inputRule")({
      showDot: OPT_INPUT_DOT_MOBILE,
    });
    const reduce = mockUpdate.mock.calls[0][0];

    expect(reduce(mockSetting).inputRule).toMatchObject({
      showDot: OPT_INPUT_DOT_MOBILE,
    });
  });
});
