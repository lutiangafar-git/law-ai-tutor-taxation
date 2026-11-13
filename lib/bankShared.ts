/** Types and helpers for the question bank that are safe to use in the browser (no question data). */

export type OutlineItem = {
  code: string;
  title: string;
  level: number;
  leaf: boolean;
  year: string;
  course: string;
  count: number;
};

export type BankQuestion = {
  id: string;
  ref: string;
  type: "mcq" | "objective" | "bar";
  q: string;
  choices?: string[];
  correct?: string;
  accept?: string[];
  hints?: string[];
  why?: string;
  alac?: { answer: string; basis: string; application: string; conclusion: string };
  keyPoints?: string[];
  cite?: string;
  pastBar?: string[];
};

/** True if `code` is `prefix` itself or a sub-item of it (e.g. "VIII.A.5" is under "VIII"). */
export function isUnder(code: string, prefix: string): boolean {
  return code === prefix || code.startsWith(prefix + ".");
}

/** Normalises an objective answer for comparison: lowercase, letters and digits only. */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
