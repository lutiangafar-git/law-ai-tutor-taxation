import { describe, expect, it } from "vitest";
import { loadAllReviewedTopics } from "@/lib/sources";
import {
  compareSyllabusRef,
  finishedTopicIds,
  isSequentialGroup,
  nextInSyllabus,
  parseSyllabusRef,
  pickRandomTopic,
} from "@/lib/topicOrder";

describe("syllabus order (2027 Bar syllabus outline)", () => {
  it("reads outline references like VIII.A.7.b", () => {
    expect(parseSyllabusRef("VIII.A.7.b")).toEqual([8, 1, 7, 2]);
    expect(parseSyllabusRef("XI")).toEqual([11]);
    expect(parseSyllabusRef("IV.E.4.b")).toEqual([4, 5, 4, 2]);
  });

  it("orders references the way the syllabus does", () => {
    const refs = ["IX.A.6", "II.A.1", "VIII.A.7", "VIII.A.1.a", "XI.A.4", "V.C", ""];
    expect([...refs].sort(compareSyllabusRef)).toEqual([
      "II.A.1", "V.C", "VIII.A.1.a", "VIII.A.7", "IX.A.6", "XI.A.4", "",
    ]);
  });

  it("every topic file has a syllabus reference and the topic list follows it", () => {
    const topics = loadAllReviewedTopics();
    for (const t of topics) expect(t.syllabusRef, t.topicId).toMatch(/^[IVXL]+(\.[A-Za-z0-9]+)*$/);
    const refs = topics.map((t) => t.syllabusRef);
    expect([...refs].sort(compareSyllabusRef)).toEqual(refs);
  });
});

describe("Year 1–2 sequential, others random", () => {
  const list = [{ topicId: "a" }, { topicId: "b" }, { topicId: "c" }];

  it("only Year 1–2 follow the syllabus in order", () => {
    expect(isSequentialGroup("year-1-2")).toBe(true);
    expect(isSequentialGroup("year-3-4")).toBe(false);
    expect(isSequentialGroup("bar-first-time")).toBe(false);
    expect(isSequentialGroup("bar-repeater")).toBe(false);
  });

  it("Year 1–2 are offered the first unfinished topic", () => {
    expect(nextInSyllabus(list, new Set())?.topicId).toBe("a");
    expect(nextInSyllabus(list, new Set(["a"]))?.topicId).toBe("b");
    expect(nextInSyllabus(list, new Set(["a", "b", "c"]))).toBeNull();
  });

  it("a topic is finished only after both its quiz and a problem drill", () => {
    const done = finishedTopicIds({
      quizResults: [{ topicId: "a" }, { topicId: "b" }],
      problemScores: [{ topicId: "a" }, { topicId: "c" }],
    });
    expect([...done]).toEqual(["a"]);
  });

  it("random picks avoid repeating the current topic", () => {
    for (const r of [0, 0.4, 0.99]) {
      expect(pickRandomTopic(list, "b", () => r)?.topicId).not.toBe("b");
    }
    expect(pickRandomTopic([{ topicId: "only" }], "only")?.topicId).toBe("only");
    expect(pickRandomTopic([], null)).toBeNull();
  });
});
