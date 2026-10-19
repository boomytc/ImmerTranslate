import {
  fabRestoreHandleStyle,
  mountFabRestoreHandle,
} from "./FabRestoreHandle";

describe("fab restore handle", () => {
  afterEach(() => {
    document.querySelectorAll(".kt-fab-restore-handle").forEach((node) => {
      node.remove();
    });
  });

  test("defaults to a translucent bar at the left edge", () => {
    expect(fabRestoreHandleStyle()).toMatchObject({
      left: "0",
      top: "50%",
      width: "8px",
      height: "48px",
      background: "rgba(32, 33, 36, 0.45)",
    });
  });

  test("uses the saved edge and the button center, not a corner", () => {
    const viewport = { width: 800, height: 600 };
    expect(
      fabRestoreHandleStyle(
        { edge: "left", x: -28, y: 400, size: 56 },
        viewport
      )
    ).toMatchObject({
      left: "0",
      top: "428px",
      width: "8px",
      height: "48px",
    });
    expect(
      fabRestoreHandleStyle(
        { edge: "right", x: 772, y: 100, size: 56 },
        viewport
      )
    ).toMatchObject({
      right: "0",
      top: "128px",
    });
    expect(
      fabRestoreHandleStyle(
        { edge: "bottom", x: 200, y: 544, size: 56 },
        viewport
      )
    ).toMatchObject({
      bottom: "0",
      left: "228px",
      height: "8px",
    });
  });

  test("keeps the bar inside the viewport when the window shrinks", () => {
    let viewport = { width: 800, height: 600 };
    const unmount = mountFabRestoreHandle({
      label: "show_fab_on_site",
      fabConfig: { edge: "left", x: 0, y: 520, size: 56 },
      viewport: () => viewport,
    });
    const handle = document.querySelector(".kt-fab-restore-handle");
    expect(handle.style.top).toBe("548px");

    viewport = { width: 800, height: 120 };
    window.dispatchEvent(new Event("resize"));
    expect(handle.style.left).toBe("0px");
    expect(handle.style.top).toBe("96px");
    const center = Number.parseFloat(handle.style.top);
    expect(center).toBeGreaterThanOrEqual(24);
    expect(center).toBeLessThanOrEqual(96);
    unmount();
  });

  test("click runs the restore callback and unmount removes the bar", () => {
    const onClick = jest.fn();
    const unmount = mountFabRestoreHandle({
      label: "show_fab_on_site",
      fabConfig: { edge: "top", x: 120, size: 56 },
      viewport: () => ({ width: 800, height: 600 }),
      onClick,
    });
    const handle = document.querySelector(".kt-fab-restore-handle");
    expect(handle.getAttribute("aria-label")).toBe("show_fab_on_site");
    expect(handle.style.top).toBe("0px");
    expect(handle.style.left).toBe("148px");
    handle.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.querySelector(".kt-fab-restore-handle")).toBeNull();
  });
});
