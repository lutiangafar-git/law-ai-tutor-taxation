/**
 * Objective and multiple-choice quiz for Year 1–2 students (spec §3.2, criteria 48–53).
 *
 * The app checks answers itself (no AI call), so checking is instant, free and can't invent law.
 * Students keep trying until they are correct:
 *   wrong try 1, 2, … → the next reviewer-written hint from the topic file;
 *   hints used up     → multiple choice: one wrong option is removed per try;
 *                       objective: one more letter of the answer is shown per try.
 * Answers and hints never leave the server until earned.
 */

export type QuizKind = "multiple-choice" | "objective";

export interface QuizItem {
  kind: QuizKind;
  question: string;
  /** Multiple choice: options keyed "A", "B", … */
  choices: { key: string; text: string }[];
  /** Multiple choice: the correct key, e.g. "B". */
  correct: string;
  /** Objective: accepted answers (compared ignoring case, punctuation and extra spaces). */
  accept: string[];
  hints: string[];
  explanation: string;
}

/** What the browser may see before the student answers correctly. */
export interface ClientQuizItem {
  kind: QuizKind;
  question: string;
  choices: { key: string; text: string }[];
}

export interface QuizCheckResult {
  correct: boolean;
  /** The hint for this wrong try (from the topic file). */
  hint?: string;
  /** Multiple choice, after hints run out: wrong options now removed. */
  eliminated?: string[];
  /** Objective, after hints run out: the answer's first letters, e.g. "exc…". */
  reveal?: string;
  /** Shown once correct. */
  explanation?: string;
  /** Shown once correct: the correct option key or the main accepted answer. */
  answer?: string;
}

export const QUIZ_SECTION_HEADING = "Objective and multiple-choice quiz (Year 1-2)";

/** Lowercase, keep letters/digits, collapse spaces. "Benefit of Excussion." → "benefit of excussion" */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Parses the quiz section of a topic file. Items are separated by blank lines and start with
 * "Q (multiple choice):" or "Q (objective):". Multiple-choice options are "A) …" lines.
 */
export function parseQuizSection(section: string): QuizItem[] {
  const blocks = section
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => /^Q\s*\(/i.test(b));

  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const head = lines[0].match(/^Q\s*\((multiple choice|objective)\):\s*(.*)$/i);
    const kind: QuizKind = head && /multiple/i.test(head[1]) ? "multiple-choice" : "objective";
    const item: QuizItem = {
      kind,
      question: head?.[2]?.trim() ?? "",
      choices: [],
      correct: "",
      accept: [],
      hints: [],
      explanation: "",
    };
    for (const line of lines.slice(1)) {
      const choice = line.match(/^([A-F])\)\s*(.+)$/);
      if (choice) {
        item.choices.push({ key: choice[1], text: choice[2].trim() });
        continue;
      }
      const field = line.match(/^(Correct|Accept|Hint|Why):\s*(.+)$/i);
      if (!field) continue;
      const [, label, value] = field;
      switch (label.toLowerCase()) {
        case "correct":
          item.correct = value.trim().toUpperCase().slice(0, 1);
          break;
        case "accept":
          item.accept = value.split("|").map((v) => v.trim()).filter(Boolean);
          break;
        case "hint":
          item.hints.push(value.trim());
          break;
        case "why":
          item.explanation = value.trim();
          break;
      }
    }
    return item;
  });
}

export function toClientQuizItem(item: QuizItem): ClientQuizItem {
  return { kind: item.kind, question: item.question, choices: item.choices };
}

function isCorrect(item: QuizItem, answer: string): boolean {
  if (item.kind === "multiple-choice") {
    return answer.trim().toUpperCase() === item.correct;
  }
  const given = normalizeAnswer(answer);
  return given !== "" && item.accept.some((a) => normalizeAnswer(a) === given);
}

/**
 * Checks one try. `wrongTriesBefore` is how many wrong tries the student already made on this item,
 * so the server can give the next hint without storing anything.
 */
export function checkQuizAnswer(
  item: QuizItem,
  answer: string,
  wrongTriesBefore: number,
): QuizCheckResult {
  if (isCorrect(item, answer)) {
    return {
      correct: true,
      explanation: item.explanation,
      answer: item.kind === "multiple-choice" ? item.correct : item.accept[0],
    };
  }

  const wrongTry = Math.max(0, wrongTriesBefore) + 1; // 1-based count including this one
  if (wrongTry <= item.hints.length) {
    return { correct: false, hint: item.hints[wrongTry - 1] };
  }

  const beyondHints = wrongTry - item.hints.length; // 1, 2, …
  const lastHint = item.hints[item.hints.length - 1];

  if (item.kind === "multiple-choice") {
    const wrongKeys = item.choices.map((c) => c.key).filter((k) => k !== item.correct);
    // Always leave the correct option plus at least one other until the student picks it.
    const removable = Math.min(beyondHints, Math.max(0, wrongKeys.length - 1));
    return {
      correct: false,
      hint: lastHint,
      eliminated: wrongKeys.slice(0, removable),
    };
  }

  const target = item.accept[0] ?? "";
  const letters = Math.min(beyondHints, Math.max(1, target.length - 1));
  return { correct: false, hint: lastHint, reveal: `${target.slice(0, letters)}…` };
}
