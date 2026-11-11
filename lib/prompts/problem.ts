import { SHARED_SOCRATIC_RULES } from "./shared";
import type { AlacElement } from "../types";

export function buildProblemScoreSystemPrompt(args: {
  topicTitle: string;
  citation: string;
  link: string;
  sourceText: string;
  keyPoints: string[];
  problem: string;
  modelAnswer: {
    answer: string;
    legalBasis: string;
    application: string;
    conclusion: string;
  };
  reviewedBy: string;
  lastReviewed: string;
}): string {
  return `${SHARED_SOCRATIC_RULES}

Feature: Problem drill scoring with the 5-point bar-coach rubric, organised by ALAC.
Do NOT give a number. Only LABEL each part of the student's answer; the app computes the 0–5 Practice score from your labels.

First decide "responsive": true if the answer addresses the legal issue the problem actually asks about;
false if it argues a different legal issue (for example, a class suit when the question is about summary procedure).

Then label each ALAC part as exactly one of "correct", "incorrect" or "missing":
- Answer: the student's opening, categorical conclusion to the question (e.g. "Yes", "No", "B2 has the better right").
  "correct" if it matches the model answer's conclusion; "incorrect" if it states a different conclusion; "missing" if no conclusion opens the answer.
- Legal basis: the rule, provision or doctrine the student relies on.
  "correct" if it is the rule in the model answer or source, stated accurately enough to decide the issue.
  "incorrect" if the rule is wrong, does not exist, or is a real rule that is not the one that decides this issue.
  "missing" if no rule is stated, including when the student states only facts or opinion as the basis.
- Application: whether the student ties the rule's requirements to the specific facts of the problem.
  "correct" if the facts are correctly matched to the rule; "incorrect" if the application is wrong or deals with a different issue;
  "missing" if the rule is never applied to these facts.
- Conclusion: the closing statement that answers the question.
  "correct" if it is stated and matches the model answer; "incorrect" if it is wrong or contradicts the opening Answer; "missing" if absent.

Judge substance, not wording or length. A correct rule in the student's own words is "correct".
Base every judgment on the reviewed source and model answer below. Do NOT reveal the full model answer yet.

Problem:
${args.problem}

Reviewed source:
Title: ${args.topicTitle}
Citation: ${args.citation}
Link: ${args.link}
Reviewed by: ${args.reviewedBy} on ${args.lastReviewed}

Source text:
${args.sourceText}

Key points:
${args.keyPoints.map((p) => `- ${p}`).join("\n")}

Model answer (for your scoring only — do not show yet):
- Answer: ${args.modelAnswer.answer}
- Legal basis: ${args.modelAnswer.legalBasis}
- Application: ${args.modelAnswer.application}
- Conclusion: ${args.modelAnswer.conclusion}

JSON schema:
{
  "verdict": "correct" | "partly correct" | "not yet",
  "responsive": boolean,
  "alacStatus": { "Answer": "correct"|"incorrect"|"missing", "Legal basis": "correct"|"incorrect"|"missing", "Application": "correct"|"incorrect"|"missing", "Conclusion": "correct"|"incorrect"|"missing" },
  "elementNotes": { "Answer": "one short reason", "Legal basis": "one short reason", "Application": "one short reason", "Conclusion": "one short reason" },
  "strengths": ["up to 2 short points"],
  "gaps": ["up to 2 short points"],
  "feedback": "1-2 sentences of coaching with the source citation; never give a number; Practice score language only",
  "oneThingToFix": "one concrete improvement on the first ALAC part (in the order Answer, Legal basis, Application, Conclusion) that is not correct",
  "nextQuestion": "a Socratic question about that same first part that is not correct; do not give the answer; empty string if every part is correct",
  "sources": [{ "title": string, "citation": string, "link": string, "reviewedBy": string, "lastReviewed": string }],
  "declined": boolean
}`;
}

export function buildProblemCoachingSystemPrompt(args: {
  topicTitle: string;
  citation: string;
  link: string;
  sourceText: string;
  keyPoints: string[];
  problem: string;
  weakElement: AlacElement;
  modelSlice: string;
  reviewedBy: string;
  lastReviewed: string;
  mode: "coach" | "rescore";
}): string {
  return `${SHARED_SOCRATIC_RULES}

Feature: Problem drill ${args.mode === "coach" ? "coaching" : "retry re-score"} on weakest element only: ${args.weakElement}.
Problem:
${args.problem}

Reviewed source for ${args.topicTitle} (${args.citation}, ${args.link}; reviewed by ${args.reviewedBy} on ${args.lastReviewed}):
${args.sourceText}

Key points:
${args.keyPoints.map((p) => `- ${p}`).join("\n")}

Model slice for ${args.weakElement} (reveal only on rescore after the student retries, or after 2 unsuccessful coaching attempts):
${args.modelSlice}

${
  args.mode === "coach"
    ? "Ask a Socratic follow-up about the weak element only. Do not show the full model answer."
    : `Label only the retried ${args.weakElement} as "correct", "incorrect" or "missing", using the same meaning as in scoring: correct = accurate and decides this issue; incorrect = wrong, nonexistent or irrelevant to the issue; missing = not stated. Set "responsive" to false only if the retry argues a different legal issue from the one asked. Do not give a number. Then you may show the model answer for that element and the full model answer summary.`
}

JSON schema:
{
  "verdict": "correct" | "partly correct" | "not yet",
  "feedback": "string with citation; use Practice score wording",
  "nextQuestion": "string",
  "elementStatus": "correct" | "incorrect" | "missing",
  "responsive": boolean,
  "showModelAnswer": boolean,
  "modelAnswer": string | null,
  "oneThingToFix": string | null,
  "sources": [{ "title": string, "citation": string, "link": string, "reviewedBy": string, "lastReviewed": string }],
  "declined": boolean
}`;
}
