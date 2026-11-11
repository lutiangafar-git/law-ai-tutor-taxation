import type { UserGroup } from "./types";

/**
 * Topic order (spec §3.2, criteria 54–58).
 * - Year 1–2: thorough and sequential, in the order of the Syllabus for the 2027 Bar Examinations.
 *   The drills page suggests the next topic the student hasn't finished.
 * - Year 3–4 and bar reviewees: random topics, to test general knowledge.
 * Each topic file carries `syllabusRef`, its place in the official syllabus outline (e.g. "VIII.A.7").
 */

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function romanToNumber(s: string): number | null {
  if (!/^[IVXLC]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    const next = ROMAN[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

/**
 * "VIII.A.7.b" → [8, 1, 7, 2]. Level 1 is Roman, level 2 a capital letter,
 * level 3 a number, level 4 a small letter, level 5 small Roman (i, ii, …).
 */
export function parseSyllabusRef(ref: string): number[] {
  if (!ref) return [];
  return ref
    .trim()
    .split(".")
    .filter(Boolean)
    .map((part, level) => {
      if (level === 0) return romanToNumber(part.toUpperCase()) ?? 999;
      if (/^\d+$/.test(part)) return Number(part);
      if (level === 4 || /^[ivx]+$/.test(part) && part.length > 1) {
        return romanToNumber(part.toUpperCase()) ?? 999;
      }
      if (/^[A-Za-z]$/.test(part)) return part.toLowerCase().charCodeAt(0) - 96;
      return romanToNumber(part.toUpperCase()) ?? 999;
    });
}

/** Sorts by position in the syllabus outline; topics without a reference go last. */
export function compareSyllabusRef(a: string | undefined, b: string | undefined): number {
  const pa = parseSyllabusRef(a ?? "");
  const pb = parseSyllabusRef(b ?? "");
  if (!pa.length && !pb.length) return 0;
  if (!pa.length) return 1;
  if (!pb.length) return -1;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/** Year 1–2 follow the syllabus in order; everyone else gets random topics. */
export function isSequentialGroup(group: UserGroup | null): boolean {
  return group === "year-1-2";
}

/** The first topic (in the given syllabus order) the student hasn't finished; null when all are done. */
export function nextInSyllabus<T extends { topicId: string }>(
  orderedTopics: T[],
  finishedIds: Set<string>,
): T | null {
  return orderedTopics.find((t) => !finishedIds.has(t.topicId)) ?? null;
}

/** A random topic, avoiding the current one when there is a choice. */
export function pickRandomTopic<T extends { topicId: string }>(
  topics: T[],
  currentId: string | null,
  random: () => number = Math.random,
): T | null {
  if (topics.length === 0) return null;
  const pool = topics.length > 1 ? topics.filter((t) => t.topicId !== currentId) : topics;
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}

/**
 * A Year 1–2 topic counts as finished once the student has completed its objective quiz
 * and at least one problem drill on it.
 */
export function finishedTopicIds(state: {
  quizResults?: { topicId: string }[];
  problemScores?: { topicId: string }[];
}): Set<string> {
  const quiz = new Set((state.quizResults ?? []).map((r) => r.topicId));
  const problem = new Set((state.problemScores ?? []).map((r) => r.topicId));
  return new Set([...quiz].filter((id) => problem.has(id)));
}

// ------------------------------------------------------------------ Year 1–2 step order within a topic

export type StepState = { done: boolean; locked: boolean; lockReason?: string };

/**
 * Year 1–2 go one step at a time within each topic (spec §3.2, criterion 61):
 *   1. objective & multiple-choice quiz → 2. recitation drill (step-by-step) → 3. problem drill (bar-style).
 * Each step unlocks when the previous one is done. Year 3–4 and bar reviewees have no locks:
 * they get bar-style problems immediately.
 */
export function topicSteps(
  group: UserGroup | null,
  topicId: string,
  state: {
    quizResults?: { topicId: string }[];
    recitationScores?: { topicId: string }[];
    problemScores?: { topicId: string }[];
  },
): Record<"objective-quiz" | "recitation-drill" | "problem-drill", StepState> {
  const has = (list: { topicId: string }[] | undefined) => (list ?? []).some((r) => r.topicId === topicId);
  const quiz = has(state.quizResults);
  const recitation = has(state.recitationScores);
  const problem = has(state.problemScores);
  const sequential = isSequentialGroup(group);
  return {
    "objective-quiz": { done: quiz, locked: false },
    "recitation-drill": {
      done: recitation,
      locked: sequential && !quiz,
      lockReason: sequential && !quiz ? "Finish the quiz on this topic first." : undefined,
    },
    "problem-drill": {
      done: problem,
      locked: sequential && !recitation,
      lockReason: sequential && !recitation ? "Finish the recitation drill on this topic first." : undefined,
    },
  };
}

// ------------------------------------------------------------------ diagnostic

/** Bar repeaters must finish the diagnostic before regular drills; first-time takers may skip it. */
export function diagnosticRequired(group: UserGroup | null, completed: boolean): boolean {
  return group === "bar-repeater" && !completed;
}

/** Diagnostic topics not yet answered, in order. */
export function remainingDiagnostic(
  diagnosticTopicIds: string[],
  problemScores: { topicId: string; isDiagnostic?: boolean }[],
): string[] {
  const done = new Set(problemScores.filter((p) => p.isDiagnostic).map((p) => p.topicId));
  return diagnosticTopicIds.filter((id) => !done.has(id));
}
