/**
 * Adaptive practice for Year 1–2 quizzes.
 *
 * 1. Second chance in the same sitting: after the last question, every question the student
 *    missed is asked again (choices in a new order) until it is answered right. A question
 *    missed again goes back in line, up to MAX_RETRY_ROUNDS times.
 * 2. Spaced review: each missed question comes back after 1 day, then 3, then 7. A right first
 *    try moves it to the next wait; a wrong answer starts it over at 1 day. After the 7-day
 *    review it counts as learned and leaves the list.
 * Everything here is plain logic (no AI call), kept in the student's browser.
 */

export const REVIEW_INTERVAL_DAYS = [1, 3, 7] as const;
export const MAX_RETRY_ROUNDS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewItem {
  topicId: string;
  itemIndex: number;
  /** 1, 2 or 3: which wait (1, 3 or 7 days) the item is on. */
  box: number;
  /** When it is next due, ISO date-time. */
  dueAt: string;
  /** How many times the student has missed it, all told. */
  misses: number;
}

const same = (a: { topicId: string; itemIndex: number }, b: { topicId: string; itemIndex: number }) =>
  a.topicId === b.topicId && a.itemIndex === b.itemIndex;

const addDays = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();

/** A question was missed: (re)start it on the 1-day wait. */
export function scheduleMissed(queue: ReviewItem[], topicId: string, itemIndex: number, now = new Date()): ReviewItem[] {
  const existing = queue.find((q) => same(q, { topicId, itemIndex }));
  const item: ReviewItem = {
    topicId,
    itemIndex,
    box: 1,
    dueAt: addDays(now, REVIEW_INTERVAL_DAYS[0]),
    misses: (existing?.misses ?? 0) + 1,
  };
  return [...queue.filter((q) => !same(q, item)), item];
}

/** A review was answered: right on the first try moves it on (or retires it); wrong starts over. */
export function recordReview(
  queue: ReviewItem[],
  topicId: string,
  itemIndex: number,
  rightFirstTry: boolean,
  now = new Date(),
): ReviewItem[] {
  const existing = queue.find((q) => same(q, { topicId, itemIndex }));
  if (!existing) return queue;
  const rest = queue.filter((q) => !same(q, existing));
  if (!rightFirstTry) return scheduleMissed(queue, topicId, itemIndex, now);
  const nextBox = existing.box + 1;
  if (nextBox > REVIEW_INTERVAL_DAYS.length) return rest; // learned
  return [...rest, { ...existing, box: nextBox, dueAt: addDays(now, REVIEW_INTERVAL_DAYS[nextBox - 1]) }];
}

/** Reviews due now, oldest first. */
export function dueReviews(queue: ReviewItem[], now = new Date()): ReviewItem[] {
  return queue.filter((q) => q.dueAt <= now.toISOString()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Questions to ask again in the same sitting: those with any wrong try on the first pass. */
export function missedOnFirstPass(wrongTriesPerItem: number[]): number[] {
  return wrongTriesPerItem.flatMap((n, i) => (n > 0 ? [i] : []));
}

/**
 * After a second-chance answer: a question still not right on the first try goes back in line,
 * unless it has already had MAX_RETRY_ROUNDS goes.
 */
export function nextRetryQueue(queue: number[], current: number, rightFirstTry: boolean, rounds: Record<number, number>): number[] {
  const rest = queue.filter((i, k) => !(k === 0 && i === current));
  const used = (rounds[current] ?? 0) + 1;
  return !rightFirstTry && used < MAX_RETRY_ROUNDS ? [...rest, current] : rest;
}

/** Share of questions right on the first try, as a whole percent. */
export function masteryPercent(rightFirstTry: number, total: number): number {
  return total > 0 ? Math.round((rightFirstTry / total) * 100) : 0;
}

/** The same choices in a different order, fixed for a given seed (so it does not jump on re-render). */
export function shuffled<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift()!); // never the same order
  return out;
}

// ------------------------------------------------------------------ Year 3–4 and bar: no repeats

/** A problem scored below this comes back once, after CONFIRM_AFTER_DAYS, to confirm it was learned. */
export const CONFIRM_BELOW_POINTS = 4;
export const CONFIRM_AFTER_DAYS = 3;

export type PickReason = "new" | "confirm" | "oldest";

/** Latest bar-problem result per topic (diagnostic runs are left out). */
export function problemHistory(
  scores: { topicId: string; points?: number; finishedAt: string; isDiagnostic?: boolean }[],
): Map<string, { lastAt: string; lastPoints: number | null; times: number }> {
  const out = new Map<string, { lastAt: string; lastPoints: number | null; times: number }>();
  for (const s of scores) {
    if (s.isDiagnostic) continue;
    const prev = out.get(s.topicId);
    const times = (prev?.times ?? 0) + 1;
    if (!prev || s.finishedAt >= prev.lastAt) out.set(s.topicId, { lastAt: s.finishedAt, lastPoints: s.points ?? null, times });
    else out.set(s.topicId, { ...prev, times });
  }
  return out;
}

/**
 * Next topic for Year 3–4 and bar reviewees, without needless repeats:
 * 1. a topic the student has never done (at random);
 * 2. else one scored below 4/5 at least 3 days ago, to confirm it (oldest first);
 * 3. else the one done longest ago.
 * Never the topic on screen now, when there is a choice.
 */
export function pickNextProblemTopic<T extends { topicId: string }>(
  topics: T[],
  scores: { topicId: string; points?: number; finishedAt: string; isDiagnostic?: boolean }[],
  currentId: string | null,
  now = new Date(),
  random: () => number = Math.random,
): { topic: T; reason: PickReason } | null {
  if (topics.length === 0) return null;
  const pool = topics.length > 1 ? topics.filter((t) => t.topicId !== currentId) : topics;
  const hist = problemHistory(scores);
  const fresh = pool.filter((t) => !hist.has(t.topicId));
  if (fresh.length > 0) return { topic: fresh[Math.floor(random() * fresh.length)] ?? fresh[0], reason: "new" };
  const cutoff = new Date(now.getTime() - CONFIRM_AFTER_DAYS * 86400000).toISOString();
  const byOldest = [...pool].sort((a, b) => hist.get(a.topicId)!.lastAt.localeCompare(hist.get(b.topicId)!.lastAt));
  const confirm = byOldest.find((t) => {
    const h = hist.get(t.topicId)!;
    return h.lastPoints !== null && h.lastPoints < CONFIRM_BELOW_POINTS && h.lastAt <= cutoff;
  });
  if (confirm) return { topic: confirm, reason: "confirm" };
  return { topic: byOldest[0], reason: "oldest" };
}

/** How many of these topics the student has not done yet. */
export function unseenCount(topics: { topicId: string }[], scores: { topicId: string; isDiagnostic?: boolean; finishedAt: string }[]): number {
  const hist = problemHistory(scores);
  return topics.filter((t) => !hist.has(t.topicId)).length;
}

// ------------------------------------------------------------------ recitation: re-drill weak steps

/** Each recitation step is scored 0–2; a step below this is "weak" and offered again. */
export const RECITATION_STEP_FULL = 2;

/** Latest recitation step scores for a topic (5 steps), or null if never done. */
export function lastRecitation(
  records: { topicId: string; stepScores: number[]; finishedAt: string }[],
  topicId: string,
): number[] | null {
  const mine = records.filter((r) => r.topicId === topicId).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  return mine.length ? mine[mine.length - 1].stepScores : null;
}

/** 1-based steps scored below full marks last time (empty when none, or never done). */
export function weakRecitationSteps(
  records: { topicId: string; stepScores: number[]; finishedAt: string }[],
  topicId: string,
): number[] {
  const last = lastRecitation(records, topicId);
  if (!last) return [];
  return [1, 2, 3, 4, 5].filter((step) => (last[step - 1] ?? 0) < RECITATION_STEP_FULL);
}

/** After practising only some steps: the new scores replace those steps; the rest stay as before. */
export function mergeStepScores(previous: number[], practised: Record<number, number>): number[] {
  return [1, 2, 3, 4, 5].map((step) => (step in practised ? practised[step] : previous[step - 1] ?? 0));
}
