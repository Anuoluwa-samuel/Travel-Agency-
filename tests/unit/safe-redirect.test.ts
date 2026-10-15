import { describe, expect, it } from "vitest";
import { liveOnly, primaryNav } from "@/config/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/account/bookings", "/account/bookings"],
    ["/admin?tab=x#y", "/admin?tab=x#y"],
    [null, "/account"],
    ["", "/account"],
    ["https://evil.example/", "/account"],
    ["//evil.example/path", "/account"],
    ["/\\evil.example", "/account"],
    ["javascript:alert(1)", "/account"],
    ["account", "/account"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe("navigation", () => {
  it("never renders links to unbuilt pages", () => {
    const flat = liveOnly(primaryNav).flatMap((i) => ("items" in i ? i.items : [i]));
    expect(flat.every((i) => i.live)).toBe(true);
  });
});
