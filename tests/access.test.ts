import { describe, expect, it } from "vitest";
import {
  CLASS_TIME_PAUSE_MESSAGE,
  canUseFeature,
  getAllowedFeatures,
  getHomeFeatureOrder,
  getManilaClockParts,
  getUsageNotice,
  isDuringClassHours,
  isPausedForClass,
} from "@/lib/access";
import type { ClassSchedule, UserGroup } from "@/lib/types";

/** Monday 6:00–9:00 PM — matches acceptance criterion 10 & 12. */
const mondayEvening: ClassSchedule = {
  blocks: [{ dayOfWeek: 1, startMinutes: 18 * 60, endMinutes: 21 * 60 }],
};

/**
 * Instant when the Philippine clock shows this Monday wall time.
 * Asia/Manila is UTC+8 with no DST, so 7:00 PM Manila = 11:00 UTC.
 * 2026-11-09 is a Monday.
 */
function mondayAtManila(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 10, 9, hour - 8, minute, 0, 0));
}

const GROUPS: UserGroup[] = [
  "year-1-2",
  "year-3-4",
  "bar-first-time",
  "bar-repeater",
];

describe("usage rules by group — class time and outside class", () => {
  for (const group of GROUPS) {
    it(`${group}: decides features at class time (Mon 7 PM Manila)`, () => {
      const now = mondayAtManila(19);
      const allowed = getAllowedFeatures(group, mondayEvening, now);

      if (group === "year-1-2") {
        expect(isPausedForClass(group, mondayEvening, now)).toBe(true);
        expect(allowed).toEqual([]);
        expect(canUseFeature(group, "recitation-drill", mondayEvening, now)).toBe(
          false,
        );
      } else if (group === "year-3-4") {
        expect(isPausedForClass(group, mondayEvening, now)).toBe(false);
        expect(allowed).toContain("in-class-quick-check");
        expect(allowed).toContain("recitation-drill");
        expect(allowed).toContain("problem-drill");
        expect(getHomeFeatureOrder(group, mondayEvening, now)[0]).toBe(
          "in-class-quick-check",
        );
      } else {
        expect(isPausedForClass(group, mondayEvening, now)).toBe(false);
        expect(allowed).toEqual(["recitation-drill", "problem-drill"]);
        expect(allowed).not.toContain("in-class-quick-check");
      }
    });

    it(`${group}: decides features outside class (Mon 10 PM Manila)`, () => {
      const now = mondayAtManila(22);
      const allowed = getAllowedFeatures(group, mondayEvening, now);

      expect(isPausedForClass(group, mondayEvening, now)).toBe(false);

      if (group === "year-1-2") {
        expect(allowed).toEqual(["objective-quiz", "recitation-drill", "problem-drill"]);
        expect(allowed).not.toContain("in-class-quick-check");
      } else if (group === "year-3-4") {
        expect(allowed).toContain("in-class-quick-check");
        expect(getHomeFeatureOrder(group, mondayEvening, now)[0]).not.toBe(
          "in-class-quick-check",
        );
      } else {
        expect(allowed).toEqual(["recitation-drill", "problem-drill"]);
      }
    });
  }
});

describe("acceptance: Year 1–2 class pause (criterion 10)", () => {
  it("pauses a Year 1–2 user at 7:00 PM Manila on Monday with a Monday 6:00–9:00 PM schedule", () => {
    // Explicit UTC instant: 2026-11-09 11:00Z == Monday 7:00 PM in Asia/Manila.
    // On Vercel the server clock is UTC; this proves we do not use UTC wall time.
    const sevenPmManila = new Date("2026-11-09T11:00:00.000Z");
    const manila = getManilaClockParts(sevenPmManila);

    expect(manila.dayOfWeek).toBe(1); // Monday
    expect(manila.minutes).toBe(19 * 60); // 7:00 PM
    expect(isDuringClassHours(mondayEvening, sevenPmManila)).toBe(true);
    expect(isPausedForClass("year-1-2", mondayEvening, sevenPmManila)).toBe(true);
    expect(getAllowedFeatures("year-1-2", mondayEvening, sevenPmManila)).toEqual(
      [],
    );
    expect(
      canUseFeature("year-1-2", "recitation-drill", mondayEvening, sevenPmManila),
    ).toBe(false);
    expect(CLASS_TIME_PAUSE_MESSAGE).toMatch(/class time/i);
  });

  it("does not treat Monday 7:00 PM UTC as class time (that is Tuesday 3:00 AM Manila)", () => {
    const sevenPmUtc = new Date("2026-11-09T19:00:00.000Z");
    expect(getManilaClockParts(sevenPmUtc).dayOfWeek).toBe(2); // Tuesday
    expect(isPausedForClass("year-1-2", mondayEvening, sevenPmUtc)).toBe(false);
  });
});

describe("acceptance: Quick Check never for Year 1–2 (criterion 11)", () => {
  it("never includes in-class-quick-check", () => {
    const outside = mondayAtManila(22);
    const inside = mondayAtManila(19);
    expect(
      getAllowedFeatures("year-1-2", mondayEvening, outside),
    ).not.toContain("in-class-quick-check");
    expect(
      getAllowedFeatures("year-1-2", mondayEvening, inside),
    ).not.toContain("in-class-quick-check");
    expect(
      canUseFeature("year-1-2", "in-class-quick-check", mondayEvening, outside),
    ).toBe(false);
  });
});

describe("acceptance: Year 3–4 Quick Check first in class (criterion 12)", () => {
  it("leads home with Quick Check at Mon 7 PM Manila", () => {
    expect(
      getHomeFeatureOrder("year-3-4", mondayEvening, mondayAtManila(19))[0],
    ).toBe("in-class-quick-check");
  });
});

describe("acceptance: bar anytime (criterion 14)", () => {
  it("allows drills at any hour with no pause", () => {
    for (const group of ["bar-first-time", "bar-repeater"] as UserGroup[]) {
      expect(
        isPausedForClass(group, mondayEvening, mondayAtManila(19)),
      ).toBe(false);
      expect(
        getAllowedFeatures(group, mondayEvening, mondayAtManila(3)),
      ).toEqual(["recitation-drill", "problem-drill"]);
    }
  });
});

describe("usage notices (criterion 9)", () => {
  it("returns the group-specific notice text", () => {
    expect(getUsageNotice("year-1-2")).toMatch(/after class/i);
    expect(getUsageNotice("year-3-4")).toMatch(/Quick Check/i);
    expect(getUsageNotice("bar-first-time")).toMatch(/Practice anytime/i);
    expect(getUsageNotice("bar-repeater")).toMatch(/Practice anytime/i);
  });
});
