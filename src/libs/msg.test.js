const mockQuery = jest.fn();
const mockSendMessage = jest.fn();

jest.mock("./browser", () => ({
  browser: {
    tabs: {
      query: (...args) => mockQuery(...args),
      sendMessage: (...args) => mockSendMessage(...args),
    },
  },
}));

const {
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_ONLY,
  MSG_TRANS_TOGGLE_STYLE,
  MSG_TRANS_PUTRULE,
} = require("../config/msg");
const {
  sendTabMsg,
  sendTopFrameMsg,
  getResolvedPageCommand,
  broadcastPageCommand,
  MSG_NO_RECEIVER,
} = require("./msg");

const RESOLVED_COMMANDS = [
  [
    MSG_TRANS_TOGGLE,
    { pageSwitch: "on", rule: { transOpen: "false" } },
    { enabled: true },
  ],
  [MSG_TRANS_TOGGLE, { pageSwitch: "off" }, { enabled: false }],
  [
    MSG_TRANS_TOGGLE_ONLY,
    { pageSwitch: "on", rule: { transOnly: "true" } },
    { transOnly: "true", enabled: true },
  ],
  [
    MSG_TRANS_TOGGLE_ONLY,
    { pageSwitch: "off", rule: { transOnly: "true" } },
    { transOnly: "true", enabled: false },
  ],
  [
    MSG_TRANS_TOGGLE_ONLY,
    { pageSwitch: "on", rule: { transOnly: "false" } },
    { transOnly: "false", enabled: true },
  ],
  [
    MSG_TRANS_TOGGLE_ONLY,
    { pageSwitch: "off", rule: { transOnly: "false" } },
    { transOnly: "false", enabled: false },
  ],
  [
    MSG_TRANS_TOGGLE_STYLE,
    { rule: { textStyle: "dashed" } },
    { textStyle: "dashed" },
  ],
];

describe("resolved page commands", () => {
  test.each(RESOLVED_COMMANDS)(
    "resolves %s from the completed response %j, not the requested arguments",
    (action, response, args) => {
      expect(
        getResolvedPageCommand(
          action,
          { enabled: false, textStyle: "none", transOnly: "false" },
          response
        )
      ).toEqual({
        action: action === MSG_TRANS_TOGGLE_STYLE ? MSG_TRANS_PUTRULE : action,
        args,
      });
    }
  );

  test.each([
    [MSG_TRANS_TOGGLE, { pageSwitch: "paused" }],
    [
      MSG_TRANS_TOGGLE_ONLY,
      { pageSwitch: "paused", rule: { transOnly: "true" } },
    ],
    [MSG_TRANS_TOGGLE, { rule: { transOpen: "true" } }],
    [MSG_TRANS_TOGGLE_ONLY, { pageSwitch: "on" }],
    [MSG_TRANS_TOGGLE_ONLY, { pageSwitch: "on", rule: { transOnly: "*" } }],
    [MSG_TRANS_TOGGLE_ONLY, { rule: { transOnly: "true" } }],
    [MSG_TRANS_TOGGLE_STYLE, { rule: {} }],
  ])("does not guess a target for %s from %j", (action, response) => {
    expect(
      getResolvedPageCommand(action, { enabled: true }, response)
    ).toBeNull();
  });

  test.each([
    MSG_TRANS_TOGGLE,
    MSG_TRANS_TOGGLE_ONLY,
    MSG_TRANS_TOGGLE_STYLE,
    "other",
  ])("does not broadcast an error response for %s", (action) => {
    expect(
      getResolvedPageCommand(
        action,
        {},
        {
          error: "Command failed",
          pageSwitch: "on",
          rule: { transOnly: "true", textStyle: "dashed" },
        }
      )
    ).toBeNull();
  });

  test.each([undefined, { enabled: true }])(
    "preserves other commands' arguments: %j",
    (args) => {
      const command = getResolvedPageCommand("other", args, {});
      expect(command).toEqual({ action: "other", args });
      expect(command.args).toBe(args);
    }
  );
});

describe("tab messaging targets", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ id: 17 }]);
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ ok: true });
  });

  test("broadcasts ordinary tab messages with the existing behavior", async () => {
    await sendTabMsg("toggle", { enabled: true });

    expect(mockSendMessage).toHaveBeenCalledWith(17, {
      action: "toggle",
      args: { enabled: true },
    });
  });

  test("targets frame zero when a top-frame response is required", async () => {
    await expect(sendTopFrameMsg("get-rule")).resolves.toEqual({ ok: true });

    expect(mockSendMessage).toHaveBeenCalledWith(
      17,
      { action: "get-rule", args: undefined, targetTopFrame: true },
      { frameId: 0 }
    );
  });

  test("keeps broadcasts on the tab whose controls initiated the action", async () => {
    await sendTabMsg("toggle", { enabled: true }, undefined, 29);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith(29, {
      action: "toggle",
      args: { enabled: true },
    });
  });

  test("uses the explicit tab and top frame without consulting active tabs", async () => {
    await sendTopFrameMsg("get-rule", undefined, 0);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith(
      0,
      { action: "get-rule", args: undefined, targetTopFrame: true },
      { frameId: 0 }
    );
  });

  test("carries a document guard only when requested by a frame-specific caller", async () => {
    await sendTopFrameMsg("edit", undefined, 17, "captured-document");
    expect(mockSendMessage).toHaveBeenCalledWith(
      17,
      {
        action: "edit",
        args: undefined,
        expectedDocumentToken: "captured-document",
        targetTopFrame: true,
      },
      { frameId: 0 }
    );
    mockSendMessage.mockClear();
    await sendTabMsg("toggle", { enabled: true }, undefined, 17);
    expect(mockSendMessage.mock.calls[0][1]).not.toHaveProperty(
      "expectedDocumentToken"
    );
  });

  test.each([0, 12])(
    "authorizes a broadcast in frame %s before forwarding to the other documents",
    async (frameId) => {
      let authorize;
      const selectedResponse = {
        document: { token: "displayed-document", frameId },
        rule: { transOpen: "true" },
      };
      mockSendMessage.mockImplementationOnce(
        () => new Promise((resolve) => (authorize = resolve))
      );
      const result = sendTabMsg(
        "toggle",
        { enabled: true },
        undefined,
        29,
        undefined,
        "displayed-document"
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, 29, {
        action: "toggle",
        args: { enabled: true },
        responseDocumentToken: "displayed-document",
      });
      authorize(selectedResponse);
      await expect(result).resolves.toBe(selectedResponse);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, 29, {
        action: "toggle",
        args: { enabled: true },
        sourceDocument: selectedResponse.document,
      });
    }
  );

  test.each(RESOLVED_COMMANDS)(
    "authorizes %s once and broadcasts the resolved target from %j",
    async (action, result, args) => {
      const response = {
        ...result,
        document: { token: "displayed-document", frameId: 12 },
      };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(
        sendTabMsg(
          action,
          undefined,
          undefined,
          29,
          undefined,
          "displayed-document"
        )
      ).resolves.toBe(response);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, 29, {
        action,
        args: undefined,
        responseDocumentToken: "displayed-document",
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, 29, {
        action: action === MSG_TRANS_TOGGLE_STYLE ? MSG_TRANS_PUTRULE : action,
        args,
        sourceDocument: response.document,
      });
    }
  );

  test.each([MSG_TRANS_TOGGLE, MSG_TRANS_TOGGLE_ONLY])(
    "does not forward an authorized %s while paused",
    async (action) => {
      const response = {
        document: { token: "displayed-document", frameId: 12 },
        pageSwitch: "paused",
        rule: { transOpen: "false", transOnly: "true" },
      };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(
        sendTabMsg(
          action,
          undefined,
          undefined,
          29,
          undefined,
          "displayed-document"
        )
      ).resolves.toBe(response);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    undefined,
    { error: "Paused while editing." },
    { document: { token: "replacement-document", frameId: 0 } },
    { document: { token: "displayed-document" } },
    { document: { token: "displayed-document", frameId: -1 } },
  ])(
    "does not forward a command without authorization: %j",
    async (response) => {
      mockSendMessage.mockResolvedValue(response);
      await expect(
        sendTabMsg(
          "toggle",
          { enabled: true },
          undefined,
          29,
          undefined,
          "displayed-document"
        )
      ).resolves.toBe(response);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    }
  );

  test("reports a missing content script instead of swallowing it", async () => {
    mockSendMessage.mockRejectedValue(
      new Error("Could not establish connection. Receiving end does not exist.")
    );

    await expect(sendTopFrameMsg("toggle_fab")).resolves.toEqual({
      error: "Could not establish connection. Receiving end does not exist.",
      code: MSG_NO_RECEIVER,
    });
  });

  test.each(RESOLVED_COMMANDS)(
    "broadcasts the top frame's resolved %s from %j with source exclusion",
    async (action, result, args) => {
      const response = {
        ...result,
        document: { token: "top-document", frameId: 0 },
      };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(broadcastPageCommand(action, 29)).resolves.toBe(response);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        1,
        29,
        { action, args: undefined, targetTopFrame: true },
        { frameId: 0 }
      );
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, 29, {
        action: action === MSG_TRANS_TOGGLE_STYLE ? MSG_TRANS_PUTRULE : action,
        args,
        sourceDocument: response.document,
      });
    }
  );

  test("resolves the active tab only once even when focus changes before the reply", async () => {
    let resolveTop;
    let markTopStarted;
    const topStarted = new Promise((resolve) => {
      markTopStarted = resolve;
    });
    const response = {
      pageSwitch: "on",
      document: { token: "top-document", frameId: 0 },
    };
    mockSendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTop = resolve;
          markTopStarted();
        })
    );
    const result = broadcastPageCommand(MSG_TRANS_TOGGLE);
    // Wait for the actual top-frame request before changing the active tab.
    await topStarted;
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    mockQuery.mockResolvedValue([{ id: 42 }]);
    resolveTop(response);
    await expect(result).resolves.toBe(response);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls.map(([tabId]) => tabId)).toEqual([
      17, 17,
    ]);
  });

  test("does not re-query when the explicit tab id is zero", async () => {
    mockSendMessage.mockResolvedValueOnce({
      pageSwitch: "off",
      document: { token: "top-document", frameId: 0 },
    });
    await broadcastPageCommand(MSG_TRANS_TOGGLE, 0);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendMessage.mock.calls.map(([tabId]) => tabId)).toEqual([0, 0]);
  });

  test("does not send or re-query when no active tab exists", async () => {
    mockQuery.mockResolvedValue([]);
    await expect(
      broadcastPageCommand(MSG_TRANS_TOGGLE)
    ).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test.each([MSG_TRANS_TOGGLE, MSG_TRANS_TOGGLE_ONLY])(
    "does not broadcast %s while the top frame stays paused",
    async (action) => {
      const response = {
        pageSwitch: "paused",
        rule: { transOpen: "false", transOnly: "true" },
        document: { token: "top-document", frameId: 0 },
      };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(broadcastPageCommand(action, 29)).resolves.toBe(response);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    undefined,
    { token: "", frameId: 0 },
    { frameId: 0 },
    { token: 123, frameId: 0 },
    { token: "top-document" },
    { token: "top-document", frameId: "0" },
    { token: "top-document", frameId: -1 },
    { token: "top-document", frameId: 0.5 },
  ])(
    "does not broadcast without a valid source document: %j",
    async (document) => {
      const response = { pageSwitch: "on", document };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(broadcastPageCommand(MSG_TRANS_TOGGLE, 29)).resolves.toBe(
        response
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    }
  );

  test.each([MSG_TRANS_TOGGLE, MSG_TRANS_TOGGLE_ONLY, MSG_TRANS_TOGGLE_STYLE])(
    "does not broadcast %s if the top frame reports an error",
    async (action) => {
      const response = {
        error: "Command failed",
        pageSwitch: "on",
        rule: { transOnly: "true", textStyle: "dashed" },
        document: { token: "top-document", frameId: 0 },
      };
      mockSendMessage.mockResolvedValueOnce(response);
      await expect(broadcastPageCommand(action, 29)).resolves.toBe(response);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    }
  );

  test("does not guess a translation target when the top frame has no receiver", async () => {
    mockSendMessage.mockRejectedValueOnce(
      new Error("Receiving end does not exist.")
    );
    await expect(broadcastPageCommand(MSG_TRANS_TOGGLE, 29)).resolves.toEqual({
      error: "Receiving end does not exist.",
      code: MSG_NO_RECEIVER,
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  test.each(["The message port closed.", "Receiving end does not exist."])(
    "preserves the top frame response when optional recipients fail: %s",
    async (message) => {
      const response = {
        pageSwitch: "on",
        document: { token: "top-document", frameId: 0 },
      };
      mockSendMessage
        .mockResolvedValueOnce(response)
        .mockRejectedValueOnce(new Error(message));
      await expect(broadcastPageCommand(MSG_TRANS_TOGGLE, 29)).resolves.toBe(
        response
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    }
  );

  test("still rejects an authorization transport failure", async () => {
    const error = new Error("The message port closed.");
    mockSendMessage.mockRejectedValueOnce(error);
    await expect(broadcastPageCommand(MSG_TRANS_TOGGLE, 29)).rejects.toBe(
      error
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  test("preserves the selected response when optional recipients disappear", async () => {
    const response = { document: { token: "displayed-document", frameId: 0 } };
    mockSendMessage
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error("The message port closed."));
    await expect(
      sendTabMsg(
        "toggle",
        undefined,
        undefined,
        29,
        undefined,
        "displayed-document"
      )
    ).resolves.toBe(response);
  });
});
