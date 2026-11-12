import matter from "gray-matter";
import { BAR_EXAM } from "./barExam";
import { parseTopicMarkdown } from "./sources";
import { SUBJECT } from "./subject";
import { parseSyllabusRef } from "./topicOrder";
import type { YearLevelTag } from "./types";

/**
 * Checks a topic drafted from an SC decision before a reviewer may download it.
 * Code checks the form and the quotes; a lawyer still checks the law.
 */
export interface DraftIssue {
  level: "error" | "warning";
  message: string;
}

/** Year tags a topic in this subject area must carry, from the year plan in lib/subject.ts. */
export function yearLevelsFor(subject: string): YearLevelTag[] {
  const tags: YearLevelTag[] = [];
  for (const y of [1, 2, 3] as const) {
    if (SUBJECT.yearAreas[y].includes(subject)) tags.push(`year-${y}` as YearLevelTag);
  }
  tags.push("year-4", "bar");
  return tags;
}

/** Lower-case words only, so line breaks, curly quotes and punctuation do not matter. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Quoted passages of 6 or more words. Short quoted terms ("to give") are left alone. */
export function quotedPassages(markdown: string): string[] {
  const out: string[] = [];
  let body = markdown;
  try {
    body = matter(markdown).content;
  } catch {
    // fall back to the whole text
  }
  body = body.replace(/<!--[\s\S]*?-->/g, " ");
  // Pair every quotation mark in order (short quotes too), then keep only the long ones,
  // so text between two short quotes is never mistaken for a quote.
  const re = /["“]([^"“”\n]*)["”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1].trim().split(/\s+/).length >= 6) out.push(m[1].trim());
  }
  return out;
}

/** Right after the case name: ", G.R. No. 123, Month D, YYYY" or " (G.R. No. 123, Month D, YYYY)". */
const CASE_CITE_TAIL =
  /^\s*[,(]?\s*G\.R\.\s*Nos?\.\s*[0-9][0-9\s,&\-and]*,\s*[A-Z][a-z]+\.?\s+\d{1,2},\s*\d{4}/;

/**
 * Every case named "X v. Y" must carry its G.R. number and date right after the name
 * (owner's rule: students remember the title, researchers check the G.R. number, teachers need the date).
 */
export function casesMissingCitation(markdown: string): string[] {
  const missing: string[] = [];
  // Party names may contain "/" and "&" (e.g. "Elric Auxiliary Services Corporation/Sacred Heart Gas Station").
  const re = /([A-Z][\wñÑ.'\-]*(?:\s+[A-Z][\wñÑ.'\-]*){0,4})\s+v(?:s)?\.\s+([A-Z][\wñÑ.'\-/&]*(?:\s+(?:[A-Z][\wñÑ.'\-/&]*|of|the|and|&))*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const tail = markdown.slice(m.index + m[0].length);
    if (!CASE_CITE_TAIL.test(tail)) missing.push(`${m[1]} v. ${m[2]}`.replace(/\s+/g, " "));
  }
  return [...new Set(missing)];
}

/** Longest run of words the problem shares with the decision (to catch copied facts). */
export function longestSharedRun(problem: string, decision: string, min = 12): number {
  const p = normalizeForMatch(problem).split(" ");
  const d = ` ${normalizeForMatch(decision)} `;
  let best = 0;
  for (let i = 0; i + min <= p.length; i++) {
    let len = min;
    if (!d.includes(` ${p.slice(i, i + len).join(" ")} `)) continue;
    while (i + len < p.length && d.includes(` ${p.slice(i, i + len + 1).join(" ")} `)) len++;
    best = Math.max(best, len);
  }
  return best;
}

export function checkDraft(
  markdown: string,
  decisionText: string,
  decision: { grNumber: string | null; date: string | null },
  /** Other official texts quotes may come from (e.g. the Code provisions in "Source text"). */
  extraSources: string[] = [],
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  let data: Record<string, unknown>;
  try {
    data = matter(markdown).data;
  } catch {
    return [{ level: "error", message: "The header (between the --- lines) cannot be read." }];
  }
  const topic = parseTopicMarkdown(markdown, "draft", { includeDrafts: true });
  if (!topic) return [{ level: "error", message: "The draft cannot be read as a topic file." }];

  if (String(data.status ?? "") !== "draft") error('status must be "draft" until a lawyer signs it off.');
  if (String(data.reviewedBy ?? "").trim() || String(data.lastReviewed ?? "").trim()) {
    error("reviewedBy and lastReviewed must stay empty: only the reviewer fills them, after checking.");
  }
  if (!topic.topicId || topic.topicId === "draft") error("topicId is missing.");
  if (!SUBJECT.areas.includes(topic.subject)) {
    error(`subject "${topic.subject}" is not a ${SUBJECT.subjectName} area in this app.`);
  } else {
    const want = yearLevelsFor(topic.subject).join(", ");
    if (topic.yearLevels.join(", ") !== want) error(`yearLevels must be [${want}] for ${topic.subject}.`);
  }
  if (parseSyllabusRef(topic.syllabusRef).length === 0) error("syllabusRef is missing or not in outline form (e.g. III.A.1.b).");
  if (topic.syllabusYear !== BAR_EXAM.year) error(`syllabusYear must be ${BAR_EXAM.year}.`);

  if (decision.grNumber && !normalizeForMatch(String(data.citation ?? "")).includes(normalizeForMatch(decision.grNumber))) {
    error(`citation must include the decision's ${decision.grNumber}.`);
  }
  if (decision.date && !normalizeForMatch(String(data.citation ?? "")).includes(normalizeForMatch(decision.date))) {
    error(`citation must include the decision's date (${decision.date}).`);
  }

  if (!topic.sourceText) error('Missing section "Source text".');
  if (topic.keyPoints.length < 3) error("Key points need at least 3 bullet points.");
  if (!topic.recitationScenario || !topic.recitationModelAnswer) error("Recitation needs a Scenario and a Model answer.");
  if (!topic.problem) error("The bar-style Problem is missing.");
  const ma = topic.modelAnswer;
  if (!ma.answer || !ma.legalBasis || !ma.application || !ma.conclusion) {
    error("The model answer needs four paragraphs starting (Answer), (Legal basis), (Application) and (Conclusion).");
  }
  if (topic.yearLevels.some((y) => y === "year-1" || y === "year-2")) {
    const mc = topic.quiz.filter((q) => q.kind === "multiple-choice").length;
    const obj = topic.quiz.filter((q) => q.kind === "objective").length;
    if (mc < 2 || obj < 2) error(`Year 1–2 topics need at least 2 multiple-choice and 2 objective quiz items (found ${mc} and ${obj}).`);
  }

  // Quotes may come from the decision, or from the Code text in "Source text" (the provision
  // itself, not text that is quoted there; the reviewer checks the provision word for word).
  const codeText = topic.sourceText.replace(/["“][^"“”\n]*["”]/g, " ");
  const haystacks = [decisionText, codeText, ...extraSources].map((t) => ` ${normalizeForMatch(t)} `);
  for (const quote of quotedPassages(markdown)) {
    // "…" or "..." marks words left out: each remaining piece must match.
    const pieces = quote
      .split(/\.\.\.|…/)
      .map((p) => normalizeForMatch(p))
      .filter((p) => p.split(" ").length >= 3);
    const found = pieces.length > 0 && pieces.every((p) => haystacks.some((h) => h.includes(` ${p} `)));
    if (!found) {
      error(`This quote is not word for word in the decision: "${quote.slice(0, 90)}${quote.length > 90 ? "…" : ""}"`);
    }
  }

  const bodyOnly = (() => {
    try {
      return matter(markdown).content.replace(/<!--[\s\S]*?-->/g, " ");
    } catch {
      return markdown;
    }
  })();
  for (const name of casesMissingCitation(bodyOnly)) {
    error(`"${name}" needs its title, G.R. number and date every time, e.g. "Soto v. Reyes-Soto, G.R. No. 249759, April 22, 2026".`);
  }

  const shared = longestSharedRun(topic.problem, decisionText);
  if (shared >= 12) warn(`The problem shares ${shared} words in a row with the decision. Write the facts fresh.`);

  if (!/bar/i.test(topic.problem.slice(0, 300))) {
    warn("The problem does not say which past Bar asked a similar issue. Add it if you know it.");
  }
  return issues;
}
