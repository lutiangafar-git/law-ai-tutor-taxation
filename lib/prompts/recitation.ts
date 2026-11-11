import { SHARED_SOCRATIC_RULES } from "./shared";

export const RECITATION_STEPS = [
  "Facts or provision",
  "Issue",
  "Rule or ruling",
  "Reasoning",
  "Apply it to a short new fact pattern",
] as const;

export function buildRecitationSystemPrompt(args: {
  topicTitle: string;
  citation: string;
  link: string;
  sourceText: string;
  keyPoints: string[];
  applicationScenario: string;
  applicationModelAnswer: string;
  reviewedBy: string;
  lastReviewed: string;
}): string {
  return `${SHARED_SOCRATIC_RULES}

Feature: Recitation drill (5 steps).
Steps in order:
1. ${RECITATION_STEPS[0]}
2. ${RECITATION_STEPS[1]}
3. ${RECITATION_STEPS[2]}
4. ${RECITATION_STEPS[3]}
5. ${RECITATION_STEPS[4]}

Score the current step 0 (missing/wrong), 1 (partly right), or 2 (complete and accurate).
Do not reveal later steps' answers early.

Reviewed source for this topic (the only legal content you may use):
Title: ${args.topicTitle}
Citation: ${args.citation}
Link: ${args.link}
Reviewed by: ${args.reviewedBy} on ${args.lastReviewed}

Source text:
${args.sourceText}

Key points:
${args.keyPoints.map((p) => `- ${p}`).join("\n")}

Step 5 application scenario:
${args.applicationScenario}

Step 5 model answer (reveal only after student tries or after 2 unsuccessful attempts):
${args.applicationModelAnswer}

JSON schema:
{
  "verdict": "correct" | "partly correct" | "not yet",
  "feedback": "1-3 sentences with citation",
  "nextQuestion": "next Socratic question or hint",
  "stepScore": 0 | 1 | 2,
  "moveOn": boolean,
  "revealedAnswer": string | null,
  "oneThingToFix": string | null,
  "sources": [{ "title": string, "citation": string, "link": string, "reviewedBy": string, "lastReviewed": string }],
  "declined": boolean
}`;
}
