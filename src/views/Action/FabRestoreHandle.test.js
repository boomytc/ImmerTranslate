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

  test("sticks to the edge where the fab was parked", () => {
    expect(
      fabRestoreHandleStyle({ edge: "right", x: 0.9, y: 0.25 })
    ).toMatchObject({
      right: "0",
      top: "25%",
      width: "8px",
    });
    expect(
      fabRestoreHandleStyle({ edge: "bottom", x: 0.4, y: 1 })
    ).toMatchObject({
      bottom: "0",
      left: "40%",
      height: "8px",
    });
  });

  test("click runs the restore callback and unmount removes the bar", () => {
    const onClick = jest.fn();
    const unmount = mountFabRestoreHandle({
      label: "show_fab_on_site",
      fabConfig: { edge: "top", x: 0.2 },
      onClick,
    });
    const handle = document.querySelector(".kt-fab-restore-handle");
    expect(handle.getAttribute("aria-label")).toBe("show_fab_on_site");
    expect(handle.style.top).toBe("0px");
    expect(handle.style.left).toBe("20%");
    handle.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.querySelector(".kt-fab-restore-handle")).toBeNull();
  });
});
