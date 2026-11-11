import {
  ALAC_ORDER,
  focusElement,
  parseAlacStatus,
  scoreAnswer,
  statusToAlacScores,
  type AlacStatus,
  type RubricResult,
} from "./rubric";
import type { AlacElement, AlacScores } from "./types";

/**
 * Turns Claude's labels into the problem-drill result. Pure functions (no network),
 * so they are tested with fake Claude replies in tests/problem-scoring.test.ts.
 */
export interface ScoredProblem {
  responsive: boolean;
  status: AlacStatus;
  rubricScore: RubricResult;
  alacScores: AlacScores;
  focus: AlacElement | null;
  elementNotes: Partial<Record<AlacElement, string>>;
  strengths: string[];
  gaps: string[];
}

function shortList(value: unknown, max = 2): string[] {
  return Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean).slice(0, max)
    : [];
}

function readNotes(value: unknown): Partial<Record<AlacElement, string>> {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const notes: Partial<Record<AlacElement, string>> = {};
  for (const el of ALAC_ORDER) {
    const note = String(obj[el] ?? "").trim();
    if (note) notes[el] = note.slice(0, 300);
  }
  return notes;
}

/** Missing or malformed "responsive" counts as responsive, so a parsing slip never zeroes a score. */
function readResponsive(value: unknown): boolean {
  return value !== false && String(value).toLowerCase() !== "false";
}

function finish(
  responsive: boolean,
  status: AlacStatus,
  extra: Pick<ScoredProblem, "elementNotes" | "strengths" | "gaps">,
): ScoredProblem {
  return {
    responsive,
    status,
    rubricScore: scoreAnswer({ responsive, status }),
    alacScores: statusToAlacScores(status),
    focus: focusElement({ responsive, status }),
    ...extra,
  };
}

/** First submission: Claude labelled the whole answer. */
export function scoreFromClaude(raw: Record<string, unknown>): ScoredProblem {
  return finish(readResponsive(raw.responsive), parseAlacStatus(raw.alacStatus), {
    elementNotes: readNotes(raw.elementNotes),
    strengths: shortList(raw.strengths),
    gaps: shortList(raw.gaps),
  });
}

/**
 * Retry of one ALAC part: keep the earlier labels, replace only the retried part,
 * and recompute the 0–5 score with the same rules.
 */
export function rescoreAfterRetry(args: {
  previous: AlacStatus;
  previousResponsive: boolean;
  element: AlacElement;
  raw: Record<string, unknown>;
}): ScoredProblem {
  const retried = parseAlacStatus({ [args.element]: args.raw.elementStatus })[args.element];
  const status: AlacStatus = { ...args.previous, [args.element]: retried };
  // A retry of the Answer that is now on-topic makes the whole answer responsive again.
  const responsive =
    args.element === "Answer"
      ? readResponsive(args.raw.responsive)
      : args.previousResponsive;
  return finish(responsive, status, { elementNotes: {}, strengths: [], gaps: [] });
}

/** "Practice score: 3/5. <why>" — the line shown above the coaching feedback. */
export function scoreHeadline(result: RubricResult): string {
  return `Practice score: ${result.points}/5. ${result.explanation}`;
}
