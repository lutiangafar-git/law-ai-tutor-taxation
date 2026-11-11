import { describe, expect, it } from "vitest";
import { GRADED_WORK_DECLINE_MESSAGE } from "@/lib/access";
import { OUTSIDE_MATERIALS_MESSAGE } from "@/lib/prompts/shared";
import {
  EMPTY_ANSWER_MESSAGE,
  validateAnswerLength,
} from "@/lib/tutorClient";

describe("empty answer (criterion 6)", () => {
  it("blocks empty answers without needing an AI call", () => {
    expect(validateAnswerLength("recitation-drill", "   ")).toBe(
      EMPTY_ANSWER_MESSAGE,
    );
    expect(validateAnswerLength("problem-drill", "")).toBe(EMPTY_ANSWER_MESSAGE);
    expect(validateAnswerLength("in-class-quick-check", "ok")).toBeNull();
  });
});

describe("length limits", () => {
  it("asks the user to shorten over-limit answers", () => {
    const long = "x".repeat(1001);
    expect(validateAnswerLength("in-class-quick-check", long)).toMatch(
      /shorten/i,
    );
  });
});

describe("grounding and graded-work messages (criteria 4 & 15)", () => {
  it("keeps the outside-materials and policy decline messages fixed", () => {
    expect(OUTSIDE_MATERIALS_MESSAGE).toMatch(/outside the reviewed materials/i);
    expect(GRADED_WORK_DECLINE_MESSAGE).toMatch(/case digests/i);
    expect(GRADED_WORK_DECLINE_MESSAGE).toMatch(/AI policy/i);
  });
});
