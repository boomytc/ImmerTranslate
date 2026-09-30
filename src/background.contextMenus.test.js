import fs from "fs";
import path from "path";
import vm from "vm";
import {
  CMD_OPEN_OPTIONS,
  CMD_OPEN_TRANBOX,
  CMD_TOGGLE_STYLE,
  CMD_TOGGLE_TRANSLATE,
  CMD_TOGGLE_TRANSLATE_ONLY,
} from "./config/msg";

// Run the production rebuild path without starting the service worker.
const source = fs.readFileSync(path.join(__dirname, "background.js"), "utf8");
const menuCode = source.slice(
  source.indexOf("let contextMenusQueue = Promise.resolve();"),
  source.indexOf("async function updateCspRules(")
);

const SIMPLE_MENUS = [
  {
    id: CMD_TOGGLE_TRANSLATE,
    title: "toggle_translate",
    contexts: ["page"],
  },
  {
    id: CMD_OPEN_TRANBOX,
    title: "translate_selection",
    contexts: ["selection"],
  },
];

const FULL_MENUS = [
  {
    id: CMD_TOGGLE_TRANSLATE,
    title: "toggle_translate",
    contexts: ["page", "selection"],
  },
  {
    id: CMD_TOGGLE_TRANSLATE_ONLY,
    title: "toggle_translate_only",
    contexts: ["page", "selection"],
  },
  {
    id: CMD_TOGGLE_STYLE,
    title: "toggle_style",
    contexts: ["page", "selection"],
  },
  {
    id: CMD_OPEN_TRANBOX,
    title: "open_tranbox",
    contexts: ["page", "selection"],
  },
  {
    id: "options_separator",
    type: "separator",
    contexts: ["page", "selection"],
  },
  {
    id: CMD_OPEN_OPTIONS,
    title: "open_options",
    contexts: ["page", "selection"],
  },
];

/**
 * Chrome commits contextMenus.create on a later turn and returns the id
 * immediately. removeAll does not cancel a create that has not committed.
 * Firefox returns a Promise that settles when the item is committed.
 */
function createHarness({ mode = "chrome", failIds = [] } = {}) {
  const items = [];
  const jobs = [];
  const failedIds = new Set(failIds);
  let removeCount = 0;
  let itemsAtSecondRemove = null;
  const runtime = { lastError: undefined };

  const browser = {
    i18n: {
      getMessage: (key) => key,
    },
    runtime,
    contextMenus: {
      removeAll: () =>
        enqueue(jobs, () => {
          removeCount += 1;
          if (removeCount === 2) itemsAtSecondRemove = items.length;
          items.splice(0, items.length);
        }),
      create: (props, callback) => {
        if (mode === "sync" && typeof callback === "function") {
          throw new Error("callback not supported");
        }
        if (mode === "sync") {
          items.push(menuItem(props));
          return props.id;
        }

        let rejectCreate;
        const created = new Promise((resolve, reject) => {
          rejectCreate = reject;
          jobs.push(() => {
            const fail = failedIds.delete(props.id);
            if (fail) {
              const message = `Cannot create item with duplicate id ${props.id}`;
              runtime.lastError = { message };
              if (typeof callback === "function") callback();
              runtime.lastError = undefined;
              if (mode === "firefox") rejectCreate(new Error(message));
              else resolve();
              return;
            }

            items.push(menuItem(props));
            if (typeof callback === "function") callback();
            resolve();
          });
        });
        return mode === "firefox" ? created : props.id;
      },
    },
  };

  const context = vm.createContext({
    browser,
    chrome: { runtime },
    kissLog: jest.fn(),
    CMD_TOGGLE_TRANSLATE,
    CMD_TOGGLE_TRANSLATE_ONLY,
    CMD_TOGGLE_STYLE,
    CMD_OPEN_TRANBOX,
    CMD_OPEN_OPTIONS,
  });
  vm.runInContext(menuCode, context);

  return {
    items,
    kissLog: context.kissLog,
    get itemsAtSecondRemove() {
      return itemsAtSecondRemove;
    },
    get pending() {
      return jobs.length;
    },
    flush() {
      const job = jobs.shift();
      if (!job) return false;
      job();
      return true;
    },
    add(type) {
      const call =
        type === undefined ? "addContextMenus()" : `addContextMenus(${type})`;
      return vm.runInContext(call, context);
    },
  };
}

function menuItem(props) {
  const item = {
    id: props.id,
    contexts: props.contexts ? [...props.contexts] : undefined,
  };
  if (props.title !== undefined) item.title = props.title;
  if (props.type !== undefined) item.type = props.type;
  return item;
}

function enqueue(jobs, work) {
  return new Promise((resolve) => {
    jobs.push(() => {
      work();
      resolve();
    });
  });
}

async function drain(harness, pending) {
  let settled = false;
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  for (let step = 0; step < 50 && !settled; step += 1) {
    harness.flush();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  if (!settled) {
    throw new Error(
      `context menu rebuild did not finish (pending jobs: ${harness.pending})`
    );
  }
  return pending;
}

describe("context menu rebuild", () => {
  test("simple mode keeps one page item and one selection item", async () => {
    const harness = createHarness();
    await drain(harness, harness.add());

    expect(harness.items).toEqual(SIMPLE_MENUS);
  });

  test("overlapping simple rebuilds leave one entry of each item", async () => {
    const harness = createHarness();
    const pending = Promise.all([harness.add(1), harness.add(1)]);
    await drain(harness, pending);

    expect(harness.items).toEqual(SIMPLE_MENUS);
    // The second removeAll must see the first rebuild already committed.
    // If create is not awaited, this is 0 and both batches land afterwards.
    expect(harness.itemsAtSecondRemove).toBe(SIMPLE_MENUS.length);
  });

  test("does not resolve a Chrome rebuild before create commits", async () => {
    const harness = createHarness();
    const pending = harness.add(1);
    let settled = false;
    pending.then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(harness.pending).toBe(1);

    harness.flush();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(harness.items).toEqual([]);

    await drain(harness, pending);
    expect(harness.items).toEqual(SIMPLE_MENUS);
  });

  test("a later menu type wins when rebuilds overlap", async () => {
    const harness = createHarness();
    await drain(harness, Promise.all([harness.add(2), harness.add(1)]));

    expect(harness.items).toEqual(SIMPLE_MENUS);
    expect(harness.itemsAtSecondRemove).toBe(FULL_MENUS.length);
  });

  test("full mode keeps its six entries and disabling clears them", async () => {
    const harness = createHarness();
    await drain(harness, harness.add(2));
    expect(harness.items).toEqual(FULL_MENUS);

    await drain(harness, harness.add(0));
    expect(harness.items).toEqual([]);
  });

  test("a sync create that rejects callbacks still rebuilds once", async () => {
    const harness = createHarness({ mode: "sync" });
    await drain(harness, Promise.all([harness.add(1), harness.add(1)]));

    expect(harness.items).toEqual(SIMPLE_MENUS);
    expect(harness.itemsAtSecondRemove).toBe(SIMPLE_MENUS.length);
  });

  test("Firefox promise creates stay serialized across overlapping rebuilds", async () => {
    const harness = createHarness({ mode: "firefox" });
    await drain(harness, Promise.all([harness.add(1), harness.add(1)]));

    expect(harness.items).toEqual(SIMPLE_MENUS);
    expect(harness.itemsAtSecondRemove).toBe(SIMPLE_MENUS.length);
  });

  test("a create failure does not block the rest of the queue", async () => {
    const harness = createHarness({ failIds: [CMD_TOGGLE_TRANSLATE] });
    await drain(harness, harness.add(1));

    expect(harness.kissLog).toHaveBeenCalledWith(
      "create contextMenus",
      expect.objectContaining({
        message: `Cannot create item with duplicate id ${CMD_TOGGLE_TRANSLATE}`,
      })
    );
    expect(harness.items).toEqual(SIMPLE_MENUS.slice(1));

    await drain(harness, harness.add(1));
    expect(harness.items).toEqual(SIMPLE_MENUS);
  });
});

describe("context menu registration", () => {
  test("still rebuilds on install, startup, and the settings message", () => {
    expect(source).toMatch(
      /browser\.runtime\.onInstalled\.addListener[\s\S]*?addContextMenus\(contextMenuType\)/
    );
    expect(source).toMatch(
      /browser\.runtime\.onStartup\.addListener[\s\S]*?addContextMenus\(contextMenuType\)/
    );
    expect(source).toContain(
      "[MSG_CONTEXT_MENUS]: (args) => addContextMenus(args)"
    );
    expect(source).toContain(
      "async function addContextMenus(contextMenuType = 1)"
    );
  });
});
