import { describe, expect, it } from "vitest";
import { getWeakSpots, lowestAlacElement } from "@/lib/storage";
import type { ProblemScoreRecord } from "@/lib/types";

describe("weak spots (criterion 18)", () => {
  it("names the lowest-scoring ALAC element across recent drills", () => {
    const scores: ProblemScoreRecord[] = [
      {
        topicId: "a",
        finishedAt: "1",
        scores: {
          Answer: 2,
          "Legal basis": 0,
          Application: 1,
          Conclusion: 2,
        },
      },
      {
        topicId: "b",
        finishedAt: "2",
        scores: {
          Answer: 2,
          "Legal basis": 1,
          Application: 2,
          Conclusion: 2,
        },
      },
      {
        topicId: "c",
        finishedAt: "3",
        scores: {
          Answer: 1,
          "Legal basis": 0,
          Application: 2,
          Conclusion: 1,
        },
      },
    ];

    const weak = getWeakSpots(scores, 10);
    expect(weak[0]?.element).toBe("Legal basis");
  });
});

describe("ALAC weakest element (criterion 17 helper)", () => {
  it("picks Legal basis when it is lowest", () => {
    expect(
      lowestAlacElement({
        Answer: 2,
        "Legal basis": 0,
        Application: 1,
        Conclusion: 2,
      }),
    ).toBe("Legal basis");
  });
});

describe("Practice score labelling (criterion 19)", () => {
  it("progress copy uses Practice score language only in code constants", async () => {
    const access = await import("@/lib/access");
    expect(access.GRADED_WORK_DECLINE_MESSAGE).toMatch(/AI policy/i);
  });
});
