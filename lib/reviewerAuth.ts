import { createHash, timingSafeEqual } from "crypto";

/**
 * The reviewer pages are protected by one passcode, set as REVIEWER_CODE in Vercel.
 * If it is not set, the reviewer tools are switched off.
 */
export type ReviewerCheck = "ok" | "not-set-up" | "wrong-code";

export function checkReviewerCode(given: unknown): ReviewerCheck {
  const expected = process.env.REVIEWER_CODE ?? "";
  if (expected.trim().length < 8) return "not-set-up";
  const a = createHash("sha256").update(String(given ?? "")).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "wrong-code";
}

export const REVIEWER_MESSAGES: Record<Exclude<ReviewerCheck, "ok">, { status: number; error: string }> = {
  "not-set-up": {
    status: 503,
    error: "The reviewer tools are switched off. Set REVIEWER_CODE (at least 8 characters) in Vercel to switch them on.",
  },
  "wrong-code": { status: 401, error: "Wrong reviewer passcode." },
};
