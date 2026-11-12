import { BAR_EXAM } from "../barExam";
import type { DecisionMeta } from "../decisions";
import { SUBJECT } from "../subject";
import { QUIZ_SECTION_HEADING } from "../quiz";

/** Longest decision text sent to Claude (a long decision still fits comfortably). */
export const MAX_DECISION_CHARS = 180_000;

export function buildDecisionDraftSystemPrompt(): string {
  const years = ([1, 2, 3] as const)
    .map((y) => `Year ${y}: ${SUBJECT.yearAreas[y].join(", ") || "(none)"}`)
    .join("\n");
  return `You draft ONE drill topic for ${SUBJECT.appName}, a drill app for Philippine law students and bar reviewees, from ONE Supreme Court decision. A lawyer reviews your draft before any student sees it.

Scope: ${SUBJECT.barSyllabusTitle}, ${BAR_EXAM.year} Bar syllabus (${BAR_EXAM.bulletin}). Allowed subject areas, exactly as written:
${SUBJECT.areas.map((a) => `- ${a}`).join("\n")}
Year plan (Year 4 and bar reviewees see every area):
${years}

Rules:
1. Use only the main opinion (ponencia). Ignore separate opinions. Teach only doctrines the Court actually applied, not obiter you are unsure of.
2. If the decision is not mainly about ${SUBJECT.subjectName}, still pick the one ${SUBJECT.subjectName} doctrine it applies, if any; if none, reply exactly NOT_IN_SCOPE.
3. Every Supreme Court case you name, every time you name it, must carry its title, G.R. number and date, e.g. "Soto v. Reyes-Soto, G.R. No. 249759, April 22, 2026". Name an older case only if this decision gives its G.R. number and date; otherwise describe the doctrine without naming the case.
4. Anything in double quotation marks must be copied word for word from the decision. Keep quotes short (one or two sentences). Do not put quotation marks around paraphrases.
5. Write the recitation scenario and the bar problem with NEW facts and new names. Never reuse the parties' names or copy the decision's facts.
6. Write the model answer like a Bar answer in Examplify: four plain paragraphs, no bullets or indents, each starting with its ALAC label in parentheses: (Answer), (Legal basis), (Application), (Conclusion). Separate the paragraphs with a blank line.
7. Quiz: at least 2 multiple-choice (A–D, "Correct:" letter, 2 hints, "Why:") and 2 objective ("Accept:" answers separated by " | ", a hint, "Why:"). Year 1–2 students should be able to answer them after reading the Key points.
8. Do not guess past Bar years. Write "Past Bar years: reviewer to confirm." unless the decision itself mentions one.
9. For syllabusRef, give the closest outline number you can (e.g. "III.A"); the reviewer will refine it.

Reply with the Markdown file only, no commentary, in exactly this shape:

---
topicId: <area-short-name>-<case-surname>-<year>, lower case, hyphens
title: "<Provision or doctrine>: <short description> (<Case title>, <G.R. No.>, <date>)"
subject: <one allowed area>
syllabusRef: "<outline number>"
syllabusYear: ${BAR_EXAM.year}
yearLevels: [filled in by the app]
status: draft
keyTerms: ["...", "..."]
citation: "<Code and articles, if any>; <Case title>, <G.R. No.>, <date>"
link: "<the decision URL>"
draftedFrom: "<Case title>, <G.R. No.>, <date> (<division>, <ponente>, J.), main opinion only"
reviewedBy: ""
lastReviewed: ""
---

# Source text
<the controlling provision(s), if any, and 1–3 short verbatim quotes from the decision, each introduced with the case title, G.R. number and date>

# Key points for the tutor (reviewer-approved)
- <4–7 short plain statements>

# Recitation drill: application fact pattern
Scenario: <2–4 sentences, new facts>
Model answer: <short answer with the rule and citation>

# Problem drill: exam or bar-style problem
Problem: (Original problem based on <Case title>, <G.R. No.>, <date>. Past Bar years: reviewer to confirm.) <new bar-style facts ending in a clear question>
Model answer:
(Answer) <one paragraph>

(Legal basis) <one paragraph>

(Application) <one paragraph>

(Conclusion) <one paragraph>

# ${QUIZ_SECTION_HEADING}
Q (multiple choice): ...
A) ...
B) ...
C) ...
D) ...
Correct: <letter>
Hint: ...
Hint: ...
Why: ...

Q (objective): ...
Accept: ... | ...
Hint: ...
Why: ...`;
}

export function buildDecisionDraftUserPrompt(args: {
  url: string;
  meta: DecisionMeta & { title?: string | null };
  text: string;
  areaHint?: string;
}): string {
  const { meta } = args;
  const lines = [
    `Decision URL: ${args.url}`,
    ...(meta.title ? [`Case title (typed by the reviewer; use exactly this title): ${meta.title}`] : []),
    `G.R. number (read by the app): ${meta.grNumber ?? "unknown"}`,
    `Date (read by the app): ${meta.date ?? "unknown"}`,
    `Division: ${meta.division ?? "unknown"}`,
    `Ponente: ${meta.ponente ?? "unknown"}`,
    `Parties: ${meta.parties ?? "unknown"}`,
  ];
  if (args.areaHint && SUBJECT.areas.includes(args.areaHint)) {
    lines.push(`The reviewer wants this subject area: ${args.areaHint}`);
  }
  const text =
    args.text.length > MAX_DECISION_CHARS ? `${args.text.slice(0, MAX_DECISION_CHARS)}\n[decision text cut here]` : args.text;
  return `${lines.join("\n")}\n\nFULL TEXT OF THE DECISION:\n<decision>\n${text}\n</decision>`;
}

/** Forces the parts the app decides itself: status, year levels and empty sign-off fields. */
export function enforceDraftHeader(markdown: string, yearLevels: string[]): string {
  let md = markdown.trim().replace(/^```(?:markdown|md)?\s*\n/, "").replace(/\n```\s*$/, "");
  const set = (key: string, value: string) => {
    const re = new RegExp(`^${key}:.*$`, "m");
    md = re.test(md) ? md.replace(re, `${key}: ${value}`) : md.replace(/^---\s*\n/, `---\n${key}: ${value}\n`);
  };
  set("yearLevels", `[${yearLevels.join(", ")}]`);
  set("status", "draft");
  set("reviewedBy", '""');
  set("lastReviewed", '""');
  return `${md}\n`;
}
