import { describe, expect, it } from "vitest";
import { BAR_EXAM } from "@/lib/barExam";
import { loadAllReviewedTopics } from "@/lib/sources";

/**
 * Scope lock: when BAR_EXAM.year changes (a new Bar Bulletin), every topic must be re-checked
 * against the new syllabus before the app can be published.
 */
describe(`every drill matches the ${BAR_EXAM.year} Bar syllabus`, () => {
  it.each(loadAllReviewedTopics().map((t) => [t.topicId, t] as const))(
    "%s was checked against the current syllabus year",
    (_id, topic) => {
      expect(topic.syllabusYear, `${topic.topicId}: re-check against ${BAR_EXAM.bulletin}`).toBe(BAR_EXAM.year);
      expect(topic.syllabusRef).not.toBe("");
    },
  );
});
