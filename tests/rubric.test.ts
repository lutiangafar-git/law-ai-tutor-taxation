import { describe, expect, it } from "vitest";
import {
  focusElement,
  parseAlacStatus,
  scoreAnswer,
  statusToAlacScores,
  type AlacStatus,
  type ElementStatus,
} from "@/lib/rubric";

/** Shorthand: c = Answer (conclusion), r = Legal basis, a = Application, end = closing Conclusion. */
function s(
  c: ElementStatus,
  r: ElementStatus,
  a: ElementStatus,
  end: ElementStatus = c,
): AlacStatus {
  return { Answer: c, "Legal basis": r, Application: a, Conclusion: end };
}

const score = (status: AlacStatus, responsive = true) =>
  scoreAnswer({ responsive, status });

describe("5-point rubric matrix (one test per row)", () => {
  it("5: correct conclusion, correct rule, correct application", () => {
    expect(score(s("correct", "correct", "correct"))).toMatchObject({ points: 5, band: "5" });
  });

  it("4: correct conclusion and rule, application missing", () => {
    expect(score(s("correct", "correct", "missing"))).toMatchObject({ points: 4, band: "4" });
  });

  it("4: correct conclusion and rule, application incorrect", () => {
    expect(score(s("correct", "correct", "incorrect"))).toMatchObject({ points: 4, band: "4" });
  });

  it("3(a): correct conclusion, incorrect rule that is applied", () => {
    expect(score(s("correct", "incorrect", "incorrect"))).toMatchObject({ points: 3, band: "3(a)" });
  });

  it("3(b): incorrect conclusion, correct rule, incorrect application", () => {
    expect(score(s("incorrect", "correct", "incorrect"))).toMatchObject({ points: 3, band: "3(b)" });
  });

  it("2(a): correct conclusion, incorrect rule, no application", () => {
    expect(score(s("correct", "incorrect", "missing"))).toMatchObject({ points: 2, band: "2(a)" });
  });

  it("2(b): incorrect conclusion, incorrect rule, applied", () => {
    expect(score(s("incorrect", "incorrect", "incorrect"))).toMatchObject({ points: 2, band: "2(b)" });
  });

  it("1(a): incorrect conclusion, a rule cited (right or wrong), no application", () => {
    expect(score(s("incorrect", "incorrect", "missing"))).toMatchObject({ points: 1, band: "1(a)" });
    expect(score(s("incorrect", "correct", "missing"))).toMatchObject({ points: 1, band: "1(a)" });
  });

  it("1(b): a conclusion (correct or not) but no rule stated", () => {
    expect(score(s("correct", "missing", "correct"))).toMatchObject({ points: 1, band: "1(b)" });
    expect(score(s("incorrect", "missing", "missing"))).toMatchObject({ points: 1, band: "1(b)" });
  });

  it("0: no conclusion, even with a correct rule and application", () => {
    expect(score(s("missing", "correct", "correct", "missing"))).toMatchObject({ points: 0, band: "0" });
  });

  it("0: an answer to a different legal issue (not responsive)", () => {
    expect(score(s("correct", "correct", "correct"), false)).toMatchObject({ points: 0, band: "0" });
  });
});

describe("which conclusion counts", () => {
  it("uses the closing Conclusion when there is no opening Answer", () => {
    expect(score(s("missing", "correct", "correct", "correct")).points).toBe(5);
  });

  it("judges the opening Answer when both are given", () => {
    // Opening says "Yes" (wrong) but the last line says "Hence, not correct" (right): judged on the opening.
    expect(score(s("incorrect", "correct", "incorrect", "correct")).band).toBe("3(b)");
  });

  it("every score explains itself in one sentence", () => {
    for (const st of [s("correct", "correct", "correct"), s("incorrect", "missing", "missing")]) {
      expect(score(st).explanation.length).toBeGreaterThan(20);
    }
  });
});

describe("coaching focus and weak-spot tracking", () => {
  it("coaches the first part that isn't correct, in ALAC order", () => {
    expect(focusElement({ responsive: true, status: s("correct", "incorrect", "missing") })).toBe(
      "Legal basis",
    );
    expect(focusElement({ responsive: true, status: s("correct", "correct", "missing") })).toBe(
      "Application",
    );
    expect(
      focusElement({ responsive: true, status: s("correct", "correct", "correct", "missing") }),
    ).toBe("Conclusion");
  });

  it("has nothing to coach when every part is correct", () => {
    expect(focusElement({ responsive: true, status: s("correct", "correct", "correct") })).toBeNull();
  });

  it("coaches the Answer when the answer is off-topic", () => {
    expect(focusElement({ responsive: false, status: s("correct", "correct", "correct") })).toBe(
      "Answer",
    );
  });

  it("maps labels to 2 / 1 / 0 for weak spots", () => {
    expect(statusToAlacScores(s("correct", "incorrect", "missing", "correct"))).toEqual({
      Answer: 2,
      "Legal basis": 1,
      Application: 0,
      Conclusion: 2,
    });
  });

  it("treats unexpected AI labels as missing", () => {
    expect(
      parseAlacStatus({ Answer: "Correct", "Legal basis": "partly", Application: null }),
    ).toEqual(s("correct", "missing", "missing", "missing"));
  });
});
