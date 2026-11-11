import { describe, expect, it } from "vitest";
import {
  BAR_LABEL,
  PROFILE_OPTIONS,
  barGroupFromHistory,
  categoryOf,
  categoryOptions,
  categoryPath,
  displayLabel,
  groupForUrl,
  missingYears,
} from "@/lib/profiles";
import { offeredYears } from "@/lib/subject";

describe("registration (one Register button → category → year or Bar history)", () => {
  it("bar reviewees: 'taken the Bar before?' No → first-time, Yes → repeater", () => {
    expect(barGroupFromHistory(false)).toBe("bar-first-time");
    expect(barGroupFromHistory(true)).toBe("bar-repeater");
  });

  it("each category has its own drills page", () => {
    expect(categoryPath("year-1-2")).toBe("/year-1-2");
    expect(categoryPath("year-3-4")).toBe("/year-3-4");
    expect(categoryPath("bar-first-time")).toBe("/bar");
    expect(categoryPath("bar-repeater")).toBe("/bar");
    expect(categoryPath(null)).toBe("/");
    expect(categoryOf("bar-repeater")).toBe("bar");
  });

  it("only categories with offered years appear, and Bar reviewee always appears last", () => {
    const cats = categoryOptions();
    const offered = offeredYears();
    expect(cats.some((c) => c.key === "year-1-2")).toBe(offered.some((y) => y <= 2));
    expect(cats.some((c) => c.key === "year-3-4")).toBe(offered.some((y) => y >= 3));
    expect(cats[cats.length - 1].key).toBe("bar");
    for (const c of cats) for (const y of c.years) expect(offered).toContain(y);
  });

  it("years a subject doesn't teach are explained, not offered", () => {
    for (const y of missingYears("year-1-2")) expect(offeredYears()).not.toContain(y);
    expect(missingYears("bar")).toEqual([]);
  });
});

describe("repeater status is confidential", () => {
  it("no on-screen label ever says repeater or first-time", () => {
    for (const p of PROFILE_OPTIONS) {
      expect(p.label.toLowerCase()).not.toMatch(/repeat|first-time|first time/);
      expect(p.blurb.toLowerCase()).not.toMatch(/repeat/);
    }
    expect(displayLabel("bar-repeater", null)).toBe(BAR_LABEL);
    expect(displayLabel("bar-first-time", null)).toBe(BAR_LABEL);
    for (const c of categoryOptions()) expect(`${c.label} ${c.blurb}`.toLowerCase()).not.toMatch(/repeat/);
  });

  it("web addresses carry 'bar', never the repeater status", () => {
    expect(groupForUrl("bar-repeater")).toBe("bar");
    expect(groupForUrl("bar-first-time")).toBe("bar");
    expect(groupForUrl("year-1-2")).toBe("year-1-2");
  });
});
