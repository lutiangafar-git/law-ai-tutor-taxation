"use client";

import { Suspense, useEffect, useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { yearQuery } from "@/lib/profiles";
import { useParams, useSearchParams } from "next/navigation";
import { AnswerBox } from "@/components/AnswerBox";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { GroupGuard } from "@/components/GroupGuard";
import { canUseFeature, isPausedForClass } from "@/lib/access";
import {
  addProblemScore,
  clearActiveDrill,
  consumeRateLimit,
  loadState,
  lowestAlacElement,
  markDiagnosticCompleted,
  saveActiveDrill,
} from "@/lib/storage";
import { callTutor, validateAnswerLength } from "@/lib/tutorClient";
import { STATUS_LABEL, STATUS_SYMBOL } from "@/lib/rubric";
import type {
  AlacElement,
  AlacElementStatus,
  AlacScores,
  RubricScore,
  TutorTurnResponse,
  UserGroup,
} from "@/lib/types";

type AlacStatusMap = Record<AlacElement, AlacElementStatus>;

const ELEMENTS: AlacElement[] = [
  "Answer",
  "Legal basis",
  "Application",
  "Conclusion",
];

function ProblemInner() {
  const params = useParams<{ topicId: string }>();
  const searchParams = useSearchParams();
  const topicId = params.topicId;
  const isDiagnostic = searchParams.get("diagnostic") === "1";

  const [group, setGroup] = useState<UserGroup | null>(null);
  const [paused, setPaused] = useState(false);
  const [title, setTitle] = useState(topicId);
  const [isDemo, setIsDemo] = useState(false);
  const [problem, setProblem] = useState("");
  const [phase, setPhase] = useState<
    "answering" | "scored" | "coaching" | "retry" | "complete"
  >("answering");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState("Loading problem…");
  const [scores, setScores] = useState<AlacScores | null>(null);
  const [weakElement, setWeakElement] = useState<AlacElement | null>(null);
  const [rubricScore, setRubricScore] = useState<RubricScore | null>(null);
  const [alacStatus, setAlacStatus] = useState<AlacStatusMap | null>(null);
  const [responsive, setResponsive] = useState(true);
  const [notes, setNotes] = useState<Partial<Record<AlacElement, string>>>({});
  const [strengths, setStrengths] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;
    setGroup(state.userGroup);
    const now = new Date();
    setPaused(isPausedForClass(state.userGroup, state.classSchedule, now));
    if (!canUseFeature(state.userGroup, "problem-drill", state.classSchedule, now)) {
      return;
    }

    fetch(
      `/api/topics?group=${state.userGroup}${yearQuery(state.studentYear)}&topicId=${topicId}&includeProblem=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.topic) {
          setTitle(data.topic.title);
          setIsDemo(Boolean(data.topic.isDemo));
          setProblem(data.topic.problem ?? "");
        }
      });

    const existing =
      state.activeDrill?.feature === "problem-drill" &&
      state.activeDrill.topicId === topicId
        ? state.activeDrill
        : null;

    if (existing) {
      setPhase(existing.phase as typeof phase);
      setAttemptCount(existing.attemptCount);
      setAnswer(existing.answers[0] ?? "");
      setScores(existing.alacScores ?? null);
      setWeakElement(existing.weakElement ?? null);
      setRubricScore(existing.rubricScore ?? null);
      setAlacStatus(existing.alacStatus ?? null);
      setResponsive(existing.responsive !== false);
      setQuestion("Continue where you left off.");
      return;
    }

    void (async () => {
      const result = await callTutor({
        feature: "problem-drill",
        topicId,
        userGroup: state.userGroup!,
        studentAnswer: "",
        action: "start",
      });
      if (result.ok) {
        // The problem itself is already shown in its own card above, so the opening
        // prompt only says what to do (avoids printing the problem twice).
        setQuestion("Read the problem above, then write your full answer below.");
        setFeedback(result.data.feedback);
        saveActiveDrill({
          feature: "problem-drill",
          topicId,
          step: 1,
          attemptCount: 0,
          answers: [],
          scores: [],
          phase: "answering",
          updatedAt: new Date().toISOString(),
        });
      } else {
        setFeedback(result.message);
      }
    })();
  }, [topicId]);

  async function submitAnswer() {
    if (!group || busy) return;
    const lengthError = validateAnswerLength("problem-drill", answer);
    if (lengthError) {
      setFeedback(lengthError);
      return;
    }
    if (!consumeRateLimit().allowed) {
      setFeedback("You've reached 30 tutor messages this hour. Try again later.");
      return;
    }

    setBusy(true);
    const result = await callTutor({
      feature: "problem-drill",
      topicId,
      userGroup: group,
      studentAnswer: answer,
      phase: "answering",
      action: "answer",
    });
    setBusy(false);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    const data: TutorTurnResponse = result.data;
    const rubric = data.rubric as AlacScores;
    const status = (data.alacStatus ?? null) as AlacStatusMap | null;
    setScores(rubric);
    setRubricScore(data.rubricScore ?? null);
    setAlacStatus(status);
    setResponsive(data.responsive !== false);
    setNotes(data.elementNotes ?? {});
    setStrengths(data.strengths ?? []);
    setGaps(data.gaps ?? []);
    setFeedback(data.feedback);

    // Every part correct: nothing to coach, so finish and show the model answer.
    if (data.modelAnswer && !data.weakElement) {
      setWeakElement(null);
      setModelAnswer(data.modelAnswer);
      setQuestion("Every part of your answer is correct. Compare it with the model answer below.");
      setPhase("complete");
      recordFinished(rubric, data.rubricScore?.points);
      return;
    }

    const weak = (data.weakElement as AlacElement) || lowestAlacElement(rubric);
    setWeakElement(weak);
    setQuestion(
      data.nextQuestion || `Let's strengthen your ${weak}. Rewrite that part only.`,
    );
    setPhase("coaching");
    setAttemptCount(0);
    saveActiveDrill({
      feature: "problem-drill",
      topicId,
      step: 1,
      attemptCount: 0,
      answers: [answer],
      scores: [],
      alacScores: rubric,
      alacStatus: status ?? undefined,
      rubricScore: data.rubricScore,
      responsive: data.responsive !== false,
      weakElement: weak,
      phase: "coaching",
      updatedAt: new Date().toISOString(),
    });
  }

  function recordFinished(finalScores: AlacScores, points?: number) {
    addProblemScore({
      topicId,
      scores: finalScores,
      points,
      finishedAt: new Date().toISOString(),
      isDiagnostic,
    });
    const state = loadState();
    if (isDiagnostic && state.problemScores.filter((x) => x.isDiagnostic).length >= 3) {
      markDiagnosticCompleted();
    }
    clearActiveDrill();
  }

  async function submitRetry() {
    if (!group || busy || !weakElement || !scores) return;
    const lengthError = validateAnswerLength("problem-drill", answer);
    if (lengthError) {
      setFeedback(lengthError);
      return;
    }
    if (!consumeRateLimit().allowed) {
      setFeedback("You've reached 30 tutor messages this hour. Try again later.");
      return;
    }

    setBusy(true);
    const result = await callTutor({
      feature: "problem-drill",
      topicId,
      userGroup: group,
      studentAnswer: answer,
      phase: "retry",
      action: "retry",
      weakElement,
      alacScores: scores,
      alacStatus: alacStatus ?? undefined,
      responsive,
      attemptCount,
    });
    setBusy(false);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    const data: TutorTurnResponse = result.data;
    const updated = (data.rubric as AlacScores) || scores;
    setScores(updated);
    if (data.rubricScore) setRubricScore(data.rubricScore);
    if (data.alacStatus) setAlacStatus(data.alacStatus as AlacStatusMap);
    // The first attempt's note no longer fits the rewritten part.
    if (weakElement) {
      setNotes((prev) => ({ ...prev, [weakElement]: "Re-checked after your rewrite." }));
    }
    setResponsive(data.responsive !== false);
    setFeedback(data.feedback);
    if (data.modelAnswer) setModelAnswer(data.modelAnswer);
    setPhase("complete");
    recordFinished(updated, data.rubricScore?.points ?? rubricScore?.points);
  }

  if (paused) return <ClassPauseBanner />;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">
          Problem drill{isDiagnostic ? " · Diagnostic" : ""}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
        {isDemo && <DemoBanner />}
      </div>

      {problem && (
        <div className="rounded-lg border border-line bg-white/80 p-4">
          <p className="text-sm font-medium text-muted">Problem</p>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{problem}</p>
        </div>
      )}

      <div className="rounded-lg border border-line bg-white/80 p-4">
        <p className="leading-relaxed">{question}</p>
        {feedback && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
            {feedback}
          </p>
        )}
      </div>

      {rubricScore && (
        <div className="rounded-lg border border-line bg-white/80 p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">Practice score</p>
            <p className="font-display text-3xl text-ink">
              {rubricScore.points}
              <span className="text-lg text-muted">/5</span>
            </p>
          </div>
          <p className="mt-1">{rubricScore.explanation}</p>
          <p className="mt-1 text-xs text-muted">
            5-point bar-coach rubric: conclusion, rule and application. Not official bar
            grading. Not a pass prediction.
          </p>
          {!responsive && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-900">
              Your answer addresses a different issue from the one asked.
            </p>
          )}
          {alacStatus && (
            <ul className="mt-3 space-y-2">
              {ELEMENTS.map((el) => (
                <li
                  key={el}
                  className={`rounded-md border px-3 py-2 ${
                    weakElement === el && phase !== "complete"
                      ? "border-accent bg-accent-soft/30"
                      : "border-line"
                  }`}
                >
                  <span className="font-medium">
                    <span aria-hidden="true">{STATUS_SYMBOL[alacStatus[el]]}</span> {el}:{" "}
                    {STATUS_LABEL[alacStatus[el]]}
                  </span>
                  {weakElement === el && phase !== "complete" ? (
                    <span className="text-accent"> · focus</span>
                  ) : null}
                  {notes[el] && <span className="block text-muted">{notes[el]}</span>}
                </li>
              ))}
            </ul>
          )}
          {(strengths.length > 0 || gaps.length > 0) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {strengths.length > 0 && (
                <div>
                  <p className="font-medium">Strengths</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {strengths.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {gaps.length > 0 && (
                <div>
                  <p className="font-medium">Needs improvement</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {gaps.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase !== "complete" && (
        <>
          <AnswerBox
            value={answer}
            onChange={setAnswer}
            maxLength={4000}
            disabled={busy}
            label={
              phase === "answering"
                ? "Your full ALAC answer"
                : `Rewrite your ${weakElement ?? "weakest part"} only`
            }
          />
          <button
            type="button"
            onClick={phase === "answering" ? submitAnswer : submitRetry}
            disabled={busy}
            className="w-full rounded-md bg-accent px-4 py-3 text-white sm:w-auto"
          >
            {busy
              ? "Checking…"
              : phase === "answering"
                ? "Submit for Practice score"
                : "Submit retry"}
          </button>
        </>
      )}

      {phase === "complete" && modelAnswer && (
        <div className="rounded-lg border border-line bg-white/80 p-4">
          <p className="font-medium">Model answer</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {modelAnswer}
          </pre>
        </div>
      )}
    </section>
  );
}

export default function ProblemPage() {
  return (
    <GroupGuard>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ProblemInner />
      </Suspense>
    </GroupGuard>
  );
}
