import { describe, expect, it } from "vitest";
import { canUseFeature, getAllowedFeatures } from "@/lib/access";
import { checkQuizAnswer, normalizeAnswer, parseQuizSection, toClientQuizItem } from "@/lib/quiz";
import { loadAllReviewedTopics } from "@/lib/sources";
import type { UserGroup } from "@/lib/types";

const SECTION = `
Q (multiple choice): A person who binds himself solidarily with the principal debtor is a:
A) Guarantor
B) Surety
C) Pledgor
D) Depositary
Correct: B
Hint: Look at the word "solidarily" in Art. 2047.
Hint: Solidary liability means the creditor can go after this person directly.
Why: Art. 2047 calls this contract a suretyship.

Q (objective): What benefit lets a guarantor insist that the creditor first exhaust the debtor's property?
Accept: benefit of excussion | excussion
Hint: It is in Art. 2058.
Why: Art. 2058 gives the guarantor the benefit of excussion.
`;

describe("objective and multiple-choice quiz (Year 1–2)", () => {
  const [mc, obj] = parseQuizSection(SECTION);

  it("parses both kinds of item", () => {
    expect(mc.kind).toBe("multiple-choice");
    expect(mc.choices.map((c) => c.key)).toEqual(["A", "B", "C", "D"]);
    expect(mc.correct).toBe("B");
    expect(mc.hints).toHaveLength(2);
    expect(obj.kind).toBe("objective");
    expect(obj.accept).toEqual(["benefit of excussion", "excussion"]);
  });

  it("never sends answers, hints or explanations to the browser before a correct try", () => {
    const client = toClientQuizItem(mc) as unknown as Record<string, unknown>;
    expect(client.correct).toBeUndefined();
    expect(client.hints).toBeUndefined();
    expect(client.explanation).toBeUndefined();
    expect(client.accept).toBeUndefined();
  });

  it("a wrong try gets the next hint, in order, and no answer", () => {
    const first = checkQuizAnswer(mc, "A", 0);
    expect(first.correct).toBe(false);
    expect(first.hint).toBe(mc.hints[0]);
    expect(first.answer).toBeUndefined();
    expect(checkQuizAnswer(mc, "C", 1).hint).toBe(mc.hints[1]);
  });

  it("after the hints run out, wrong options are removed one per try, never the correct one", () => {
    const third = checkQuizAnswer(mc, "A", 2);
    expect(third.eliminated).toHaveLength(1);
    expect(third.eliminated).not.toContain("B");
    const many = checkQuizAnswer(mc, "A", 10);
    expect(many.eliminated).toHaveLength(2); // the correct option plus one other always stay
    expect(many.eliminated).not.toContain("B");
  });

  it("objective answers ignore case, punctuation and spacing; extra hints reveal letters", () => {
    expect(normalizeAnswer("  Benefit of  Excussion. ")).toBe("benefit of excussion");
    expect(checkQuizAnswer(obj, "BENEFIT OF EXCUSSION", 0).correct).toBe(true);
    expect(checkQuizAnswer(obj, "excussion!", 3).correct).toBe(true);
    const wrong = checkQuizAnswer(obj, "benefit of division", 1);
    expect(wrong.correct).toBe(false);
    expect(wrong.reveal).toBe("b…");
    expect(checkQuizAnswer(obj, "x", 3).reveal).toBe("ben…");
  });

  it("a correct try returns the explanation and the answer", () => {
    const ok = checkQuizAnswer(mc, "b", 5);
    expect(ok.correct).toBe(true);
    expect(ok.answer).toBe("B");
    expect(ok.explanation).toContain("Art. 2047");
  });
});

describe("who gets the quiz", () => {
  const evening = { blocks: [{ dayOfWeek: 1, startMinutes: 18 * 60, endMinutes: 21 * 60 }] };
  const mondayTenPm = new Date("2026-11-16T14:00:00Z"); // Mon 10:00 PM Manila

  it("Year 1–2 get it outside class; Year 3–4 and bar reviewees never do", () => {
    expect(canUseFeature("year-1-2", "objective-quiz", evening, mondayTenPm)).toBe(true);
    for (const g of ["year-3-4", "bar-first-time", "bar-repeater"] as UserGroup[]) {
      expect(getAllowedFeatures(g, evening, mondayTenPm)).not.toContain("objective-quiz");
    }
  });

  it("the quiz pauses during class like every Year 1–2 feature", () => {
    const mondaySevenPm = new Date("2026-11-16T11:00:00Z"); // Mon 7:00 PM Manila
    expect(canUseFeature("year-1-2", "objective-quiz", evening, mondaySevenPm)).toBe(false);
  });
});

describe("quiz content in /sources", () => {
  const topics = loadAllReviewedTopics();
  const early = topics.filter((t) => t.yearLevels.includes("year-1") || t.yearLevels.includes("year-2"));

  it("if this subject has no Year 1–2 topics, Year 1–2 are not offered (so no quiz is needed)", async () => {
    const { offeredYears } = await import("@/lib/subject");
    if (early.length === 0) {
      expect(offeredYears()).not.toContain(1);
      expect(offeredYears()).not.toContain(2);
    } else {
      expect(early.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(early.length === 0).each(early.map((t) => [t.topicId, t] as const))(
    "%s (a Year 1–2 topic) has a complete quiz",
    (_id, topic) => {
      const mcs = topic.quiz.filter((q) => q.kind === "multiple-choice");
      const objs = topic.quiz.filter((q) => q.kind === "objective");
      expect(mcs.length).toBeGreaterThanOrEqual(2);
      expect(objs.length).toBeGreaterThanOrEqual(2);
      for (const q of topic.quiz) {
        expect(q.question).not.toBe("");
        expect(q.hints.length).toBeGreaterThanOrEqual(1);
        expect(q.explanation).not.toBe("");
        if (q.kind === "multiple-choice") {
          expect(q.choices.length).toBeGreaterThanOrEqual(3);
          expect(q.choices.map((c) => c.key)).toContain(q.correct);
        } else {
          expect(q.accept.length).toBeGreaterThanOrEqual(1);
        }
      }
    },
  );
});
