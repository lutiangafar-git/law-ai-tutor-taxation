import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  GRADED_WORK_DECLINE_MESSAGE,
  canUseFeature,
} from "@/lib/access";
import { buildProblemCoachingSystemPrompt, buildProblemScoreSystemPrompt } from "@/lib/prompts/problem";
import { buildQuickCheckSystemPrompt } from "@/lib/prompts/quickCheck";
import {
  RECITATION_STEPS,
  buildRecitationSystemPrompt,
} from "@/lib/prompts/recitation";
import { OUTSIDE_MATERIALS_MESSAGE } from "@/lib/prompts/shared";
import { logTutorEvent } from "@/lib/monitoring";
import { rescoreAfterRetry, scoreFromClaude, scoreHeadline } from "@/lib/problemScoring";
import { parseAlacStatus } from "@/lib/rubric";
import { getTopicById } from "@/lib/sources";
import type {
  AlacElement,
  AlacScores,
  Feature,
  TutorTurnResponse,
  UserGroup,
} from "@/lib/types";

export const runtime = "nodejs";

const FAST_MODEL = "claude-haiku-5-5";
const STRONG_MODEL = "claude-sonnet-5-5";

const TUTOR_UNAVAILABLE_MESSAGE =
  "The tutor is unavailable right now. Your answer is saved, so try again in a minute.";

type Body = {
  feature: Feature;
  topicId: string;
  userGroup: UserGroup;
  studentAnswer: string;
  step?: number;
  attemptCount?: number;
  exchangeCount?: number;
  phase?: string;
  weakElement?: AlacElement;
  alacScores?: AlacScores;
  /** Labels from the first scoring, sent back on retry so the score can be recomputed. */
  alacStatus?: unknown;
  responsive?: boolean;
  action?: "start" | "answer" | "retry";
  classSchedule?: { blocks: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] };
};

const GRADED_WORK_RE =
  /write\s+(my|a|the)?\s*(case\s*digest|paper|memorandum|memo|essay|assignment)|graded\s+work/i;

function sourceRefs(topic: NonNullable<ReturnType<typeof getTopicById>>) {
  return [
    {
      title: topic.title,
      citation: topic.citation,
      link: topic.link,
      reviewedBy: topic.reviewedBy,
      lastReviewed: topic.lastReviewed,
    },
  ];
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function askClaude(args: {
  model: string;
  system: string;
  user: string;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("missing_key");
  }

  const client = new Anthropic({ apiKey });
  const started = Date.now();
  const message = await client.messages.create({
    model: args.model,
    max_tokens: 8000,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  logTutorEvent({
    event: "tutor_call",
    model: args.model,
    ms: Date.now() - started,
    outcome: message.stop_reason ?? "unknown",
  });

  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
    throw new Error("tutor_unavailable");
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return parseJson(text);
}

function openingRecitation(topic: NonNullable<ReturnType<typeof getTopicById>>): TutorTurnResponse {
  return {
    verdict: "not yet",
    feedback: "Practice score starts when you answer. No explanation yet — try first.",
    nextQuestion: `Looking at ${topic.title}: in your own words, what does the provision or fact pattern say? (${topic.citation})`,
    sources: sourceRefs(topic),
  };
}

function openingProblem(topic: NonNullable<ReturnType<typeof getTopicById>>): TutorTurnResponse {
  return {
    verdict: "not yet",
    feedback:
      "Write a full practice answer using Answer, Legal basis, Application, and Conclusion. The model answer stays hidden until after your retry.",
    nextQuestion: topic.problem || `Answer this problem on ${topic.title}.`,
    sources: sourceRefs(topic),
  };
}

function openingQuickCheck(topic: NonNullable<ReturnType<typeof getTopicById>>): TutorTurnResponse {
  return {
    verdict: "not yet",
    feedback:
      "Type your own answer first (issue and ruling as you would recite). Feedback comes only after you send it.",
    nextQuestion: `Quick Check — ${topic.title}: what is the issue and ruling, in your own words?`,
    sources: sourceRefs(topic),
  };
}

function modelSlice(
  topic: NonNullable<ReturnType<typeof getTopicById>>,
  element: AlacElement,
): string {
  const map: Record<AlacElement, string> = {
    Answer: topic.modelAnswer.answer,
    "Legal basis": topic.modelAnswer.legalBasis,
    Application: topic.modelAnswer.application,
    Conclusion: topic.modelAnswer.conclusion,
  };
  return map[element];
}

function formatFullModel(topic: NonNullable<ReturnType<typeof getTopicById>>): string {
  return [
    `Answer: ${topic.modelAnswer.answer}`,
    `Legal basis: ${topic.modelAnswer.legalBasis}`,
    `Application: ${topic.modelAnswer.application}`,
    `Conclusion: ${topic.modelAnswer.conclusion}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const {
      feature,
      topicId,
      userGroup,
      studentAnswer = "",
      step = 1,
      attemptCount = 0,
      exchangeCount = 0,
      phase = "answering",
      weakElement,
      action = "answer",
      classSchedule,
    } = body;

    if (!feature || !topicId || !userGroup) {
      return NextResponse.json(
        { feedback: TUTOR_UNAVAILABLE_MESSAGE },
        { status: 400 },
      );
    }

    // Class hours are evaluated in Asia/Manila inside /lib/access.ts (not server local/UTC).
    if (!canUseFeature(userGroup, feature, classSchedule ?? { blocks: [] }, new Date())) {
      return NextResponse.json(
        {
          verdict: "not yet",
          feedback: "It's class time. Come back after class to review.",
          declined: true,
        } satisfies TutorTurnResponse,
        { status: 403 },
      );
    }

    // The objective quiz is checked by /api/quiz without any AI call.
    if (feature === "objective-quiz") {
      return NextResponse.json(
        { feedback: TUTOR_UNAVAILABLE_MESSAGE },
        { status: 400 },
      );
    }

    const topic = getTopicById(topicId, userGroup);
    if (!topic) {
      return NextResponse.json(
        {
          verdict: "not yet",
          feedback: OUTSIDE_MATERIALS_MESSAGE,
        } satisfies TutorTurnResponse,
        { status: 404 },
      );
    }

    if (action === "start") {
      if (feature === "recitation-drill") {
        return NextResponse.json(openingRecitation(topic));
      }
      if (feature === "problem-drill") {
        return NextResponse.json(openingProblem(topic));
      }
      return NextResponse.json(openingQuickCheck(topic));
    }

    const trimmed = studentAnswer.trim();
    if (!trimmed) {
      return NextResponse.json(
        {
          verdict: "not yet",
          feedback: "Type your answer first. A rough one is fine.",
        } satisfies TutorTurnResponse,
        { status: 400 },
      );
    }

    if (GRADED_WORK_RE.test(trimmed)) {
      return NextResponse.json({
        verdict: "not yet",
        feedback: GRADED_WORK_DECLINE_MESSAGE,
        declined: true,
        sources: sourceRefs(topic),
      } satisfies TutorTurnResponse);
    }

    const limits: Record<Feature, number> = {
      "objective-quiz": 200,
      "in-class-quick-check": 1000,
      "recitation-drill": 2000,
      "problem-drill": 4000,
    };
    if (trimmed.length > limits[feature]) {
      return NextResponse.json({
        verdict: "not yet",
        feedback: `Please shorten your answer to ${limits[feature]} characters or fewer.`,
      } satisfies TutorTurnResponse);
    }

    if (feature === "recitation-drill") {
      const system = buildRecitationSystemPrompt({
        topicTitle: topic.title,
        citation: topic.citation,
        link: topic.link,
        sourceText: topic.sourceText,
        keyPoints: topic.keyPoints,
        applicationScenario: topic.recitationScenario,
        applicationModelAnswer: topic.recitationModelAnswer,
        reviewedBy: topic.reviewedBy,
        lastReviewed: topic.lastReviewed,
      });

      const user = [
        `Current step: ${step} — ${RECITATION_STEPS[step - 1] ?? "Apply"}`,
        `Attempt count on this step: ${attemptCount}`,
        step === 5 ? `Application scenario: ${topic.recitationScenario}` : "",
        `Student answer: ${trimmed}`,
        "Respond with JSON only.",
      ]
        .filter(Boolean)
        .join("\n");

      const raw = await askClaude({ model: FAST_MODEL, system, user });
      const stepScore = Number(raw.stepScore ?? 0);
      const moveOn =
        Boolean(raw.moveOn) || stepScore >= 2 || attemptCount + 1 >= 2;

      const response: TutorTurnResponse = {
        verdict: (raw.verdict as TutorTurnResponse["verdict"]) || "not yet",
        feedback: String(raw.feedback ?? ""),
        nextQuestion: String(raw.nextQuestion ?? ""),
        rubric: { [`step-${step}`]: stepScore },
        oneThingToFix: raw.oneThingToFix ? String(raw.oneThingToFix) : undefined,
        sources: sourceRefs(topic),
        declined: Boolean(raw.declined),
      };

      if (moveOn && stepScore < 2 && attemptCount + 1 >= 2) {
        response.feedback = `${response.feedback} Revealed for this step (${topic.citation}): ${
          step === 5 ? topic.recitationModelAnswer : String(raw.revealedAnswer ?? topic.keyPoints[0] ?? topic.sourceText)
        } ${topic.link}`;
      }

      return NextResponse.json({ ...response, moveOn, stepScore });
    }

    if (feature === "in-class-quick-check") {
      if (exchangeCount >= 2) {
        return NextResponse.json({
          verdict: "partly correct",
          feedback: "This Quick Check ends after two exchanges. Review the citation and continue in class.",
          sources: sourceRefs(topic),
        } satisfies TutorTurnResponse);
      }

      const system = buildQuickCheckSystemPrompt({
        topicTitle: topic.title,
        citation: topic.citation,
        link: topic.link,
        sourceText: topic.sourceText,
        keyPoints: topic.keyPoints,
        reviewedBy: topic.reviewedBy,
        lastReviewed: topic.lastReviewed,
      });

      const raw = await askClaude({
        model: FAST_MODEL,
        system,
        user: `Exchange ${exchangeCount + 1} of 2.\nStudent answer: ${trimmed}\nRespond with JSON only.`,
      });

      const endCheck = Boolean(raw.endCheck) || exchangeCount + 1 >= 2;

      return NextResponse.json({
        verdict: (raw.verdict as TutorTurnResponse["verdict"]) || "partly correct",
        feedback: String(raw.feedback ?? ""),
        nextQuestion: endCheck ? undefined : String(raw.nextQuestion ?? ""),
        sources: sourceRefs(topic),
        declined: Boolean(raw.declined),
        oneThingToFix: endCheck ? "Use the citation when you recite." : undefined,
      } satisfies TutorTurnResponse);
    }

    // problem-drill
    if (phase === "coaching" || phase === "retry" || action === "retry") {
      const element = (weakElement || "Legal basis") as AlacElement;
      const mode = action === "retry" || phase === "retry" ? "rescore" : "coach";
      const system = buildProblemCoachingSystemPrompt({
        topicTitle: topic.title,
        citation: topic.citation,
        link: topic.link,
        sourceText: topic.sourceText,
        keyPoints: topic.keyPoints,
        problem: topic.problem,
        weakElement: element,
        modelSlice: modelSlice(topic, element),
        reviewedBy: topic.reviewedBy,
        lastReviewed: topic.lastReviewed,
        mode,
      });

      const raw = await askClaude({
        model: STRONG_MODEL,
        system,
        user: `Weak element: ${element}\nAttempt: ${attemptCount}\nStudent answer: ${trimmed}\nRespond with JSON only.`,
      });

      const showModel =
        mode === "rescore" || Boolean(raw.showModelAnswer) || attemptCount + 1 >= 2;

      const retried = rescoreAfterRetry({
        previous: parseAlacStatus(body.alacStatus),
        previousResponsive: body.responsive !== false,
        element,
        raw,
      });

      return NextResponse.json({
        verdict: (raw.verdict as TutorTurnResponse["verdict"]) || "partly correct",
        feedback: `${scoreHeadline(retried.rubricScore)} ${String(raw.feedback ?? "")} (Practice score — not official bar grading.)`,
        nextQuestion: String(raw.nextQuestion ?? ""),
        oneThingToFix: raw.oneThingToFix ? String(raw.oneThingToFix) : undefined,
        weakElement: element,
        modelAnswer: showModel
          ? String(raw.modelAnswer ?? formatFullModel(topic))
          : undefined,
        rubric: retried.alacScores,
        rubricScore: retried.rubricScore,
        alacStatus: retried.status,
        responsive: retried.responsive,
        sources: sourceRefs(topic),
      } satisfies TutorTurnResponse);
    }

    const system = buildProblemScoreSystemPrompt({
      topicTitle: topic.title,
      citation: topic.citation,
      link: topic.link,
      sourceText: topic.sourceText,
      keyPoints: topic.keyPoints,
      problem: topic.problem,
      modelAnswer: topic.modelAnswer,
      reviewedBy: topic.reviewedBy,
      lastReviewed: topic.lastReviewed,
    });

    const raw = await askClaude({
      model: STRONG_MODEL,
      system,
      user: `Student full answer:\n${trimmed}\nRespond with JSON only. Do not reveal the model answer yet.`,
    });

    const scored = scoreFromClaude(raw);
    const allCorrect = scored.focus === null;

    return NextResponse.json({
      verdict: allCorrect ? "correct" : scored.rubricScore.points >= 3 ? "partly correct" : "not yet",
      feedback: `${scoreHeadline(scored.rubricScore)} ${String(raw.feedback ?? "")} (Practice score — not official bar grading.)`,
      // Nothing to coach on a perfect answer: show the model answer straight away.
      nextQuestion: allCorrect ? "" : String(raw.nextQuestion ?? ""),
      modelAnswer: allCorrect ? formatFullModel(topic) : undefined,
      rubric: scored.alacScores,
      rubricScore: scored.rubricScore,
      alacStatus: scored.status,
      responsive: scored.responsive,
      elementNotes: scored.elementNotes,
      strengths: scored.strengths,
      gaps: scored.gaps,
      weakElement: scored.focus ?? undefined,
      oneThingToFix: allCorrect
        ? undefined
        : String(raw.oneThingToFix ?? `Strengthen your ${scored.focus}.`),
      sources: sourceRefs(topic),
      declined: Boolean(raw.declined),
    } satisfies TutorTurnResponse);
  } catch (error) {
    logTutorEvent({
      event: "tutor_error",
      outcome: error instanceof Error ? error.message.slice(0, 80) : "unknown",
    });
    return NextResponse.json(
      {
        verdict: "not yet",
        feedback: TUTOR_UNAVAILABLE_MESSAGE,
      } satisfies TutorTurnResponse,
      { status: 503 },
    );
  }
}
