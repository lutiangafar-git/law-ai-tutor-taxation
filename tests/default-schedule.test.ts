import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultStudentClassSchedule,
  getEffectiveClassSchedule,
  getHomeFeatureOrder,
  isDuringClassHours,
  isPausedForClass,
  isStudentGroup,
} from "@/lib/access";
import {
  clearClassSchedule,
  loadState,
  setClassSchedule,
  setUserGroup,
} from "@/lib/storage";
import type { ClassSchedule } from "@/lib/types";

/** Instant for a Philippine wall clock time (Asia/Manila = UTC+8, no DST). */
function manilaAt(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0));
}

function expectDefaultShape(schedule: ClassSchedule) {
  const byDay = new Map(schedule.blocks.map((b) => [b.dayOfWeek, b]));
  expect(schedule.blocks).toHaveLength(7);

  for (const day of [1, 2, 3, 4, 5]) {
    const block = byDay.get(day);
    expect(block?.startMinutes).toBe(18 * 60);
    expect(block?.endMinutes).toBe(21 * 60);
  }
  for (const day of [6, 0]) {
    const block = byDay.get(day);
    expect(block?.startMinutes).toBe(8 * 60);
    expect(block?.endMinutes).toBe(18 * 60);
  }
}

function installLocalStorageMock() {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", { localStorage: localStorageMock });
  return localStorageMock;
}

describe("acceptance 24: default schedule for new Year 1–2 / Year 3–4 users", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-fills Mon–Fri 6:00–9:00 PM and Sat–Sun 8:00 AM–6:00 PM, and allows edit or clear", () => {
    expectDefaultShape(createDefaultStudentClassSchedule());

    const year12 = setUserGroup("year-1-2");
    expect(isStudentGroup(year12.userGroup)).toBe(true);
    expectDefaultShape(year12.classSchedule);
    expectDefaultShape(loadState().classSchedule);

    const year34 = setUserGroup("year-3-4");
    // Student → student keeps the existing schedule (still shown in Settings).
    expectDefaultShape(year34.classSchedule);

    const edited = setClassSchedule({
      blocks: [
        {
          dayOfWeek: 1,
          startMinutes: 17 * 60,
          endMinutes: 20 * 60,
          label: "Monday 5:00–8:00 PM",
        },
      ],
    });
    expect(edited.classSchedule.blocks).toHaveLength(1);
    expect(loadState().classSchedule.blocks[0].startMinutes).toBe(17 * 60);

    const cleared = clearClassSchedule();
    expect(cleared.classSchedule.blocks).toEqual([]);
    expect(loadState().classSchedule.blocks).toEqual([]);
  });
});

describe("acceptance 25: Year 1–2 pause windows on the default schedule", () => {
  it("pauses Wed 7:30 PM and Sat 10:00 AM Manila; not Wed 9:00 PM or Sat 6:00 PM", () => {
    const schedule = createDefaultStudentClassSchedule();

    // 2026-11-11 = Wednesday, 2026-11-14 = Saturday
    const wed730 = manilaAt(2026, 11, 11, 19, 30);
    const sat1000 = manilaAt(2026, 11, 14, 10, 0);
    const wed900 = manilaAt(2026, 11, 11, 21, 0);
    const sat1800 = manilaAt(2026, 11, 14, 18, 0);

    expect(isDuringClassHours(schedule, wed730)).toBe(true);
    expect(isPausedForClass("year-1-2", schedule, wed730)).toBe(true);

    expect(isDuringClassHours(schedule, sat1000)).toBe(true);
    expect(isPausedForClass("year-1-2", schedule, sat1000)).toBe(true);

    expect(isDuringClassHours(schedule, wed900)).toBe(false);
    expect(isPausedForClass("year-1-2", schedule, wed900)).toBe(false);

    expect(isDuringClassHours(schedule, sat1800)).toBe(false);
    expect(isPausedForClass("year-1-2", schedule, sat1800)).toBe(false);
  });
});

describe("acceptance 26: Year 3–4 default schedule leads with Quick Check on Sunday afternoon", () => {
  it("puts In-class Quick Check first on Sunday at 2:00 PM Manila", () => {
    const schedule = createDefaultStudentClassSchedule();
    // 2026-11-15 = Sunday
    const sunday2pm = manilaAt(2026, 11, 15, 14, 0);

    expect(isDuringClassHours(schedule, sunday2pm)).toBe(true);
    expect(getHomeFeatureOrder("year-3-4", schedule, sunday2pm)[0]).toBe(
      "in-class-quick-check",
    );
  });
});

describe("acceptance 27: bar reviewees have no class schedule shown or applied", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears schedule on bar groups and never applies leftover blocks", () => {
    setUserGroup("year-1-2");
    expect(loadState().classSchedule.blocks.length).toBe(7);

    const barFirst = setUserGroup("bar-first-time");
    expect(barFirst.classSchedule.blocks).toEqual([]);
    expect(loadState().classSchedule.blocks).toEqual([]);
    expect(
      getEffectiveClassSchedule("bar-first-time", loadState().classSchedule),
    ).toEqual({ blocks: [] });

    const leftover: ClassSchedule = createDefaultStudentClassSchedule();
    expect(getEffectiveClassSchedule("bar-repeater", leftover)).toEqual({
      blocks: [],
    });
    expect(
      isPausedForClass(
        "bar-repeater",
        leftover,
        manilaAt(2026, 11, 11, 19, 30),
      ),
    ).toBe(false);
    expect(
      getHomeFeatureOrder(
        "bar-first-time",
        leftover,
        manilaAt(2026, 11, 15, 14, 0),
      ),
    ).toEqual(["recitation-drill", "problem-drill"]);

    const barRepeater = setUserGroup("bar-repeater");
    expect(barRepeater.classSchedule.blocks).toEqual([]);
  });
});
