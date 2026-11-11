import type { AlacElement, AlacElementStatus, AlacScores } from "./types";

/**
 * 5-point bar-coach rubric for problem drills, aligned with ALAC.
 *
 * Claude only LABELS each part of the student's answer (correct / incorrect / missing)
 * and says whether the answer addresses the question asked. This file turns those
 * labels into the 0–5 Practice score with fixed rules, so the same labels always
 * give the same score and every row of the rubric is unit-tested.
 *
 * ALAC ↔ rubric:  Answer = the conclusion · Legal basis = the rule ·
 *                 Application = applying the rule to the facts ·
 *                 Conclusion = the closing statement (a structure check).
 */

export type ElementStatus = AlacElementStatus;
export type AlacStatus = Record<AlacElement, ElementStatus>;

export type RubricBand =
  | "5"
  | "4"
  | "3(a)"
  | "3(b)"
  | "2(a)"
  | "2(b)"
  | "1(a)"
  | "1(b)"
  | "0";

export interface RubricResult {
  points: 0 | 1 | 2 | 3 | 4 | 5;
  band: RubricBand;
  explanation: string;
}

export const ALAC_ORDER: AlacElement[] = [
  "Answer",
  "Legal basis",
  "Application",
  "Conclusion",
];

export const RUBRIC_MAX = 5;

/**
 * The conclusion the rubric judges: the opening Answer if the student gave one,
 * otherwise the closing Conclusion.
 */
function conclusionStatus(status: AlacStatus): ElementStatus {
  return status.Answer !== "missing" ? status.Answer : status.Conclusion;
}

export function scoreAnswer(input: {
  responsive: boolean;
  status: AlacStatus;
}): RubricResult {
  const { responsive, status } = input;
  const c = conclusionStatus(status);
  const r = status["Legal basis"];
  const a = status.Application;

  // 0: the answer addresses a different issue, so it gives no conclusion to the question asked.
  if (!responsive) {
    return {
      points: 0,
      band: "0",
      explanation:
        "Your answer addresses a different legal issue from the one asked, so it gives no conclusion to this question.",
    };
  }

  // 0: no conclusion at all, even if a rule and an application were written.
  if (c === "missing") {
    return {
      points: 0,
      band: "0",
      explanation:
        "No conclusion was given. A conclusion is indispensable, even when a rule is stated and applied.",
    };
  }

  // 1(b): a conclusion, but no rule (only facts or opinion as the basis).
  if (r === "missing") {
    return {
      points: 1,
      band: "1(b)",
      explanation:
        "You gave a conclusion but stated no rule; facts alone are not a legal basis.",
    };
  }

  if (c === "correct") {
    if (r === "correct") {
      if (a === "correct") {
        return {
          points: 5,
          band: "5",
          explanation:
            "Correct conclusion, correct rule, and the rule is correctly applied to the facts.",
        };
      }
      return {
        points: 4,
        band: "4",
        explanation:
          a === "missing"
            ? "Correct conclusion and correct rule, but the rule is not applied to the facts."
            : "Correct conclusion and correct rule, but the rule is applied to the facts incorrectly.",
      };
    }
    // Correct conclusion, incorrect rule.
    if (a === "missing") {
      return {
        points: 2,
        band: "2(a)",
        explanation:
          "Correct conclusion, but the rule cited is incorrect and it is not applied to the facts.",
      };
    }
    return {
      points: 3,
      band: "3(a)",
      explanation:
        "Correct conclusion, but the rule cited is incorrect, even though it is applied to the facts.",
    };
  }

  // Incorrect conclusion.
  if (a === "missing") {
    return {
      points: 1,
      band: "1(a)",
      explanation:
        "Incorrect conclusion; a rule is cited but it is not applied to the facts.",
    };
  }
  if (r === "correct") {
    return {
      points: 3,
      band: "3(b)",
      explanation:
        "The rule cited is correct, but it is applied incorrectly and leads to an incorrect conclusion.",
    };
  }
  return {
    points: 2,
    band: "2(b)",
    explanation:
      "Incorrect conclusion and incorrect rule, although the rule is applied to the facts.",
  };
}

/** For weak-spot tracking: correct = 2, stated but wrong = 1, missing = 0. */
export function statusToAlacScores(status: AlacStatus): AlacScores {
  const value = (s: ElementStatus) => (s === "correct" ? 2 : s === "incorrect" ? 1 : 0);
  return {
    Answer: value(status.Answer),
    "Legal basis": value(status["Legal basis"]),
    Application: value(status.Application),
    Conclusion: value(status.Conclusion),
  };
}

/**
 * Which part to coach first: the first part, in ALAC order, that isn't correct.
 * A non-responsive answer is coached on the Answer (address the question asked).
 * Returns null when every part is correct (nothing to coach).
 */
export function focusElement(input: {
  responsive: boolean;
  status: AlacStatus;
}): AlacElement | null {
  if (!input.responsive) return "Answer";
  return ALAC_ORDER.find((el) => input.status[el] !== "correct") ?? null;
}

/** Reads Claude's labels defensively; anything unexpected counts as "missing". */
export function parseAlacStatus(raw: unknown): AlacStatus {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const read = (key: AlacElement): ElementStatus => {
    const v = String(obj[key] ?? "").trim().toLowerCase();
    return v === "correct" || v === "incorrect" ? v : "missing";
  };
  return {
    Answer: read("Answer"),
    "Legal basis": read("Legal basis"),
    Application: read("Application"),
    Conclusion: read("Conclusion"),
  };
}

export const STATUS_SYMBOL: Record<ElementStatus, string> = {
  correct: "✓",
  incorrect: "✗",
  missing: "–",
};

export const STATUS_LABEL: Record<ElementStatus, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  missing: "Not stated",
};
