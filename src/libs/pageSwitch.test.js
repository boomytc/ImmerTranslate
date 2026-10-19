import {
  SITE_TRANS_OPEN,
  sitePolicy,
  siteTransOpenValue,
} from "./siteTransOpen";
import { ManualOverride, PAGE_SWITCH, pageSwitchState } from "./pageSwitch";

const URL = "http://localhost/spa2.html/plain";
const OTHER = "http://localhost/other-clear";

function state(input) {
  const policy =
    input.policy !== undefined
      ? input.policy
      : input.rule &&
          Object.prototype.hasOwnProperty.call(input.rule, "transOpen")
        ? sitePolicy(input.rule.transOpen)
        : undefined;
  return pageSwitchState({
    href: URL,
    globalTransOpen: "false",
    ...input,
    policy,
  });
}

describe("page switch", () => {
  test("S01 rejects an illegal transOpen instead of treating it as follow", () => {
    expect(() => siteTransOpenValue(false)).toThrow(TypeError);
    expect(() => siteTransOpenValue(undefined)).toThrow(TypeError);
    expect(() => siteTransOpenValue("yes")).toThrow(TypeError);
    expect(() =>
      state({ rule: { transOpen: false }, blacklistHit: false })
    ).toThrow(TypeError);
  });

  test("S02 Don't and Follow stay different when global is on", () => {
    expect(
      state({
        rule: { transOpen: "false" },
        blacklistHit: false,
        globalTransOpen: "true",
      })
    ).toBe(PAGE_SWITCH.OFF);
    expect(
      state({
        rule: { transOpen: "*" },
        blacklistHit: false,
        globalTransOpen: "true",
      })
    ).toBe(PAGE_SWITCH.ON);
    expect(SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE).not.toBe(
      SITE_TRANS_OPEN.FOLLOW_GLOBAL
    );
  });

  test.each([
    ["S03", "manual on, policy unchanged", "on", "*", false, URL, "on"],
    ["S04", "manual off, policy unchanged", "off", "*", false, URL, "off"],
    ["S05", "manual on, blacklist hits", "on", "*", true, URL, "paused"],
    ["S06", "manual off, blacklist hits", "off", "true", true, URL, "paused"],
    [
      "S07",
      "manual on, policy changed to never",
      "on",
      "false",
      false,
      URL,
      "off",
    ],
    [
      "S08",
      "manual off, policy changed to always",
      "off",
      "true",
      false,
      URL,
      "on",
    ],
    ["S09", "manual on, url changed", "on", "*", false, OTHER, "off"],
    [
      "S10",
      "manual off, url changed to an always rule",
      "off",
      "true",
      false,
      OTHER,
      "on",
    ],
    ["S11", "no manual, always", null, "true", false, URL, "on"],
    ["S12", "no manual, never", null, "false", false, URL, "off"],
    ["S13", "no manual, follow global off", null, "*", false, URL, "off"],
    ["S14", "no rule and not blocked", null, null, false, URL, "off"],
    ["S15", "no rule and blocked", null, null, true, URL, "paused"],
    [
      "S16",
      "non-policy fields do not void a manual on",
      "on",
      "*",
      false,
      URL,
      "on",
    ],
  ])("%s %s", (_id, _label, manual, policy, blocked, href, expected) => {
    const override =
      manual && policy
        ? new ManualOverride(URL, "*", manual === "on" ? "on" : "off")
        : manual
          ? new ManualOverride(URL, "true", manual === "on" ? "on" : "off")
          : null;
    const rule =
      policy === null
        ? null
        : {
            transOpen: policy,
            fromLang: "en",
            selector: "article",
          };
    expect(
      pageSwitchState({
        rule,
        policy: policy === null ? undefined : sitePolicy(policy),
        href,
        blacklistHit: blocked,
        override,
        globalTransOpen: "false",
      })
    ).toBe(expected);
  });

  test("S17 a manual value recorded against Follow does not apply to Don't", () => {
    const override = new ManualOverride(URL, "*", "on");
    expect(override.applies(URL, "*")).toBe(true);
    expect(override.applies(URL, "false")).toBe(false);
    expect(
      state({
        rule: { transOpen: "false" },
        blacklistHit: false,
        override,
      })
    ).toBe(PAGE_SWITCH.OFF);
  });

  test("S18 top frame and iframe judge the blacklist separately", () => {
    const rule = { transOpen: "true" };
    const policy = sitePolicy("true");
    expect(
      pageSwitchState({
        rule,
        policy,
        href: "http://localhost/top",
        blacklistHit: true,
        globalTransOpen: "false",
      })
    ).toBe(PAGE_SWITCH.PAUSED);
    expect(
      pageSwitchState({
        rule,
        policy,
        href: "http://localhost/child",
        blacklistHit: false,
        globalTransOpen: "false",
      })
    ).toBe(PAGE_SWITCH.ON);
  });

  test("S19 blacklist does not clear the override object", () => {
    const override = new ManualOverride(URL, "false", "on");
    state({
      rule: { transOpen: "false" },
      blacklistHit: true,
      override,
    });
    expect(override.applies(URL, "false")).toBe(true);
    expect(override.value).toBe("on");
  });

  test("a folded transOpen string is not a site policy", () => {
    expect(() =>
      pageSwitchState({
        rule: { transOpen: "false" },
        policy: "false",
        href: URL,
        blacklistHit: false,
      })
    ).toThrow(/folded rule transOpen/);
  });
});
