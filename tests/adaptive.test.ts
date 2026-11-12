import { describe, expect, it } from "vitest";
import {
  MAX_RETRY_ROUNDS,
  dueReviews,
  masteryPercent,
  missedOnFirstPass,
  nextRetryQueue,
  recordReview,
  scheduleMissed,
  shuffled,
  type ReviewItem,
} from "@/lib/adaptive";

const T0 = new Date("2026-11-12T08:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86400000);

describe("second chance in the same sitting", () => {
  it("re-asks every question with a wrong try", () => {
    expect(missedOnFirstPass([0, 2, 0, 1])).toEqual([1, 3]);
    expect(missedOnFirstPass([0, 0])).toEqual([]);
  });
  it("a question right on the second chance leaves the line", () => {
    expect(nextRetryQueue([1, 3], 1, true, {})).toEqual([3]);
  });
  it("a question missed again goes to the back of the line", () => {
    expect(nextRetryQueue([1, 3], 1, false, {})).toEqual([3, 1]);
  });
  it(`stops after ${MAX_RETRY_ROUNDS} goes so the student is never stuck`, () => {
    expect(nextRetryQueue([1], 1, false, { 1: MAX_RETRY_ROUNDS - 1 })).toEqual([]);
  });
});

describe("spaced review: 1 day, 3 days, 7 days", () => {
  it("a missed question is due tomorrow", () => {
    const q = scheduleMissed([], "t", 2, T0);
    expect(q).toEqual([{ topicId: "t", itemIndex: 2, box: 1, dueAt: days(1).toISOString(), misses: 1 }]);
    expect(dueReviews(q, T0)).toEqual([]);
    expect(dueReviews(q, days(1))).toHaveLength(1);
  });
  it("right on the first try moves it to 3 days, then 7, then it is learned", () => {
    let q: ReviewItem[] = scheduleMissed([], "t", 0, T0);
    q = recordReview(q, "t", 0, true, days(1));
    expect(q[0]).toMatchObject({ box: 2, dueAt: days(4).toISOString() });
    q = recordReview(q, "t", 0, true, days(4));
    expect(q[0]).toMatchObject({ box: 3, dueAt: days(11).toISOString() });
    q = recordReview(q, "t", 0, true, days(11));
    expect(q).toEqual([]);
  });
  it("a wrong answer starts it over at 1 day and counts the miss", () => {
    let q: ReviewItem[] = scheduleMissed([], "t", 0, T0);
    q = recordReview(q, "t", 0, true, days(1));
    q = recordReview(q, "t", 0, false, days(4));
    expect(q[0]).toMatchObject({ box: 1, dueAt: days(5).toISOString(), misses: 2 });
  });
  it("missing it again in a new quiz resets, without duplicates", () => {
    let q = scheduleMissed([], "t", 0, T0);
    q = scheduleMissed(q, "t", 0, days(2));
    expect(q).toHaveLength(1);
    expect(q[0].misses).toBe(2);
  });
  it("lists due reviews oldest first", () => {
    let q = scheduleMissed([], "b", 0, days(1));
    q = scheduleMissed(q, "a", 0, T0);
    expect(dueReviews(q, days(5)).map((r) => r.topicId)).toEqual(["a", "b"]);
  });
});

describe("mastery and shuffling", () => {
  it("mastery is the share right on the first try", () => {
    expect(masteryPercent(3, 4)).toBe(75);
    expect(masteryPercent(0, 0)).toBe(0);
  });
  it("shuffles choices into a new, stable order", () => {
    const list = ["A", "B", "C", "D"];
    const a = shuffled(list, 42);
    expect(a).toEqual(shuffled(list, 42));
    expect(a).not.toEqual(list);
    expect([...a].sort()).toEqual(list);
  });
});
