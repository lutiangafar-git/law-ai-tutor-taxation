import { describe, expect, it } from "vitest";
import { loadAllReviewedTopics } from "@/lib/sources";
import { SUBJECT, areasForYear, offeredYears } from "@/lib/subject";
import { PROFILE_OPTIONS } from "@/lib/profiles";
import type { YearLevelTag } from "@/lib/types";

/**
 * Locks the year-by-year scope in /lib/subject.ts (2027 Bar syllabus) to the real topic files,
 * so a topic can't drift into the wrong year or the wrong subject.
 */
describe(`${SUBJECT.appName}: subject scope`, () => {
  const topics = loadAllReviewedTopics();

  it("every topic belongs to one of this subject's areas (no mixing of subjects)", () => {
    for (const topic of topics) {
      expect(SUBJECT.areas, `${topic.topicId} has subject "${topic.subject}"`).toContain(
        topic.subject,
      );
    }
  });

  it.each([1, 2, 3] as const)(
    "Year %i tags match the year plan exactly",
    (year) => {
      const tag = `year-${year}` as YearLevelTag;
      for (const topic of topics) {
        const shouldShow = SUBJECT.yearAreas[year].includes(topic.subject);
        expect(
          topic.yearLevels.includes(tag),
          `${topic.topicId} (${topic.subject}) ${shouldShow ? "needs" : "must not have"} ${tag}`,
        ).toBe(shouldShow);
      }
    },
  );

  it("every year area in the plan is a known area", () => {
    for (const year of [1, 2, 3] as const) {
      for (const area of SUBJECT.yearAreas[year]) expect(SUBJECT.areas).toContain(area);
    }
  });

  it("every offered year has at least one topic file", () => {
    for (const year of offeredYears()) {
      if (year === 4) continue;
      const tag = `year-${year}` as YearLevelTag;
      expect(topics.some((t) => t.yearLevels.includes(tag)), `no topic for Year ${year}`).toBe(true);
    }
  });

  it("the landing page offers only years with topics, plus both bar groups", () => {
    const keys = PROFILE_OPTIONS.map((p) => p.key);
    for (const year of [1, 2, 3] as const) {
      expect(keys.includes(`year-${year}`)).toBe(areasForYear(year).length > 0);
    }
    expect(keys).toContain("year-4");
    expect(keys).toContain("bar-first-time");
    expect(keys).toContain("bar-repeater");
  });
});
