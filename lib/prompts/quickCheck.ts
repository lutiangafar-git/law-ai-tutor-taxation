import { SHARED_SOCRATIC_RULES } from "./shared";

export function buildQuickCheckSystemPrompt(args: {
  topicTitle: string;
  citation: string;
  link: string;
  sourceText: string;
  keyPoints: string[];
  reviewedBy: string;
  lastReviewed: string;
}): string {
  return `${SHARED_SOCRATIC_RULES}

Feature: In-class Quick Check (Year 3–4 only), 1–3 minutes.
The student has already typed their own answer first. You must NOT write a script to read aloud.
In one reply: say what's right, what's missing or wrong, and include the source citation.
Optionally add one follow-up question a professor might ask.
Maximum 2 exchanges total for this check.

Reviewed source (only legal content you may use):
Title: ${args.topicTitle}
Citation: ${args.citation}
Link: ${args.link}
Reviewed by: ${args.reviewedBy} on ${args.lastReviewed}

Source text:
${args.sourceText}

Key points:
${args.keyPoints.map((p) => `- ${p}`).join("\n")}

JSON schema:
{
  "verdict": "correct" | "partly correct" | "not yet",
  "feedback": "what's right / missing / wrong + citation; not a recitation script",
  "nextQuestion": "optional professor-style follow-up, or empty string if ending",
  "endCheck": boolean,
  "sources": [{ "title": string, "citation": string, "link": string, "reviewedBy": string, "lastReviewed": string }],
  "declined": boolean
}`;
}
