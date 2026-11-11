import { describe, expect, it } from "vitest";
import { rescoreAfterRetry, scoreFromClaude, scoreHeadline } from "@/lib/problemScoring";

/** Fake Claude replies: no API key or network needed. */
const wrongRuleReply = {
  verdict: "partly correct",
  responsive: true,
  alacStatus: {
    Answer: "correct",
    "Legal basis": "incorrect",
    Application: "incorrect",
    Conclusion: "correct",
  },
  elementNotes: {
    Answer: "Correctly says the class suit is improper.",
    "Legal basis": "Cites a rule that does not exist.",
  },
  strengths: ["Clear conclusion", "Attempts to apply a rule", "a third one is dropped"],
  gaps: ["Wrong rule"],
  feedback: "Which requirement does the Rules of Court actually set for a class suit?",
};

describe("scoring a first answer from Claude's labels", () => {
  it("correct conclusion + wrong rule + application = 3/5, band 3(a)", () => {
    const scored = scoreFromClaude(wrongRuleReply);
    expect(scored.rubricScore.points).toBe(3);
    expect(scored.rubricScore.band).toBe("3(a)");
    expect(scored.focus).toBe("Legal basis");
    expect(scored.alacScores).toEqual({
      Answer: 2,
      "Legal basis": 1,
      Application: 1,
      Conclusion: 2,
    });
    expect(scored.strengths).toHaveLength(2);
    expect(scored.elementNotes["Legal basis"]).toMatch(/does not exist/);
  });

  it("the score comes from the labels, even if Claude also sends a number", () => {
    const scored = scoreFromClaude({ ...wrongRuleReply, points: 5, score: "5/5" });
    expect(scored.rubricScore.points).toBe(3);
  });

  it("an off-topic answer scores 0 and is coached on the Answer", () => {
    const scored = scoreFromClaude({ ...wrongRuleReply, responsive: false });
    expect(scored.rubricScore.points).toBe(0);
    expect(scored.focus).toBe("Answer");
  });

  it("a perfect answer has nothing to coach", () => {
    const scored = scoreFromClaude({
      responsive: true,
      alacStatus: {
        Answer: "correct",
        "Legal basis": "correct",
        Application: "correct",
        Conclusion: "correct",
      },
    });
    expect(scored.rubricScore.points).toBe(5);
    expect(scored.focus).toBeNull();
  });

  it("a malformed reply never crashes and never awards points", () => {
    const scored = scoreFromClaude({ alacStatus: "oops" });
    expect(scored.rubricScore.points).toBe(0);
  });

  it("the headline shows the score out of 5 with its reason", () => {
    expect(scoreHeadline(scoreFromClaude(wrongRuleReply).rubricScore)).toMatch(
      /^Practice score: 3\/5\. Correct conclusion, but the rule cited is incorrect/,
    );
  });
});

describe("re-scoring after a retry of one ALAC part", () => {
  const previous = scoreFromClaude(wrongRuleReply);

  it("fixing the Legal basis lifts 3(a) to 4 (rule now right, application still wrong)", () => {
    const after = rescoreAfterRetry({
      previous: previous.status,
      previousResponsive: true,
      element: "Legal basis",
      raw: { elementStatus: "correct" },
    });
    expect(after.status.Answer).toBe("correct");
    expect(after.rubricScore.points).toBe(4);
    expect(after.focus).toBe("Application");
  });

  it("an off-topic answer becomes scorable once the retried Answer is on-topic", () => {
    const after = rescoreAfterRetry({
      previous: previous.status,
      previousResponsive: false,
      element: "Answer",
      raw: { elementStatus: "correct", responsive: true },
    });
    expect(after.responsive).toBe(true);
    expect(after.rubricScore.points).toBe(3);
  });
});
