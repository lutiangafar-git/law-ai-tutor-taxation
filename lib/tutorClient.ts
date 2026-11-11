import { loadState } from "./storage";
import type {
  AlacScores,
  Feature,
  TutorTurnResponse,
  UserGroup,
} from "./types";

export type TutorRequestBody = {
  feature: Feature;
  topicId: string;
  userGroup: UserGroup;
  studentAnswer: string;
  step?: number;
  attemptCount?: number;
  exchangeCount?: number;
  phase?: string;
  weakElement?: string;
  alacScores?: AlacScores;
  /** Problem-drill retry: labels from the first scoring, so the 0–5 score can be recomputed. */
  alacStatus?: Record<string, string>;
  responsive?: boolean;
  action?: "start" | "answer" | "retry";
};

const EMPTY_ANSWER_MESSAGE = "Type your answer first. A rough one is fine.";
const UNAVAILABLE_MESSAGE =
  "The tutor is unavailable right now. Your answer is saved, so try again in a minute.";

export function validateAnswerLength(
  feature: Feature,
  answer: string,
): string | null {
  const trimmed = answer.trim();
  if (!trimmed) return EMPTY_ANSWER_MESSAGE;
  const limits: Record<Feature, number> = {
    "objective-quiz": 200,
    "in-class-quick-check": 1000,
    "recitation-drill": 2000,
    "problem-drill": 4000,
  };
  if (trimmed.length > limits[feature]) {
    return `Please shorten your answer to ${limits[feature]} characters or fewer.`;
  }
  return null;
}

export async function callTutor(
  body: TutorRequestBody,
  opts?: { timeoutMs?: number },
): Promise<{ ok: true; data: TutorTurnResponse } | { ok: false; message: string }> {
  const timeoutMs =
    opts?.timeoutMs ??
    (body.feature === "in-class-quick-check" ? 10_000 : 30_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const schedule = loadState().classSchedule;
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, classSchedule: schedule }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, message: UNAVAILABLE_MESSAGE };
    }

    const data = (await res.json()) as TutorTurnResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  } finally {
    clearTimeout(timer);
  }
}

export { EMPTY_ANSWER_MESSAGE, UNAVAILABLE_MESSAGE };
