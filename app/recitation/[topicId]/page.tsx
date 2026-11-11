"use client";

import { useEffect, useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { yearQuery } from "@/lib/profiles";
import { useParams } from "next/navigation";
import { AnswerBox } from "@/components/AnswerBox";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { GroupGuard } from "@/components/GroupGuard";
import { canUseFeature, isPausedForClass } from "@/lib/access";
import { RECITATION_STEPS } from "@/lib/prompts/recitation";
import {
  addRecitationScore,
  clearActiveDrill,
  consumeRateLimit,
  loadState,
  saveActiveDrill,
} from "@/lib/storage";
import {
  callTutor,
  validateAnswerLength,
} from "@/lib/tutorClient";
import type { DrillProgress, UserGroup } from "@/lib/types";

function RecitationInner() {
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId;

  const [group, setGroup] = useState<UserGroup | null>(null);
  const [paused, setPaused] = useState(false);
  const [title, setTitle] = useState(topicId);
  const [isDemo, setIsDemo] = useState(false);
  const [scenario, setScenario] = useState("");
  const [step, setStep] = useState(1);
  const [attemptCount, setAttemptCount] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;
    setGroup(state.userGroup);
    const now = new Date();
    setPaused(isPausedForClass(state.userGroup, state.classSchedule, now));

    if (!canUseFeature(state.userGroup, "recitation-drill", state.classSchedule, now)) {
      return;
    }

    const existing =
      state.activeDrill?.feature === "recitation-drill" &&
      state.activeDrill.topicId === topicId
        ? state.activeDrill
        : null;

    fetch(`/api/topics?group=${state.userGroup}${yearQuery(state.studentYear)}&topicId=${topicId}&includeScenario=1`)
      .then((r) => r.json())
      .then((data) => {
        if (data.topic) {
          setTitle(data.topic.title);
          setIsDemo(Boolean(data.topic.isDemo));
          setScenario(data.topic.recitationScenario ?? "");
        }
      });

    if (existing) {
      setStep(existing.step);
      setAttemptCount(existing.attemptCount);
      setAnswers(existing.answers);
      setScores(existing.scores);
      setAnswer(existing.answers[existing.step - 1] ?? "");
      setQuestion(`Continue step ${existing.step}: ${RECITATION_STEPS[existing.step - 1]}`);
      return;
    }

    void (async () => {
      const result = await callTutor({
        feature: "recitation-drill",
        topicId,
        userGroup: state.userGroup!,
        studentAnswer: "",
        action: "start",
        step: 1,
      });
      if (result.ok) {
        setQuestion(result.data.nextQuestion || "What does the provision say?");
        setFeedback(result.data.feedback);
        persist({
          feature: "recitation-drill",
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

  function persist(drill: DrillProgress) {
    saveActiveDrill(drill);
  }

  async function send() {
    if (!group || busy) return;
    const lengthError = validateAnswerLength("recitation-drill", answer);
    if (lengthError) {
      setFeedback(lengthError);
      return;
    }

    const rate = consumeRateLimit();
    if (!rate.allowed) {
      setFeedback("You've reached 30 tutor messages this hour. Try again later.");
      return;
    }

    setBusy(true);
    const state = loadState();
    const result = await callTutor({
      feature: "recitation-drill",
      topicId,
      userGroup: group,
      studentAnswer: answer,
      step,
      attemptCount,
      action: "answer",
    });
    setBusy(false);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    const data = result.data as typeof result.data & {
      moveOn?: boolean;
      stepScore?: number;
    };
    setFeedback(data.feedback);
    if (data.nextQuestion) setQuestion(data.nextQuestion);

    const stepScore = Number(data.stepScore ?? 0);
    const nextAnswers = [...answers];
    nextAnswers[step - 1] = answer;
    const nextScores = [...scores];
    nextScores[step - 1] = stepScore;

    const moveOn = Boolean(data.moveOn) || stepScore >= 2 || attemptCount + 1 >= 2;

    if (moveOn) {
      if (step >= 5) {
        setDone(true);
        setScores(nextScores);
        addRecitationScore(topicId, nextScores);
        clearActiveDrill();
        setQuestion("Recitation complete. Review your Practice score below.");
        return;
      }
      const nextStep = step + 1;
      setStep(nextStep);
      setAttemptCount(0);
      setAnswers(nextAnswers);
      setScores(nextScores);
      setAnswer("");
      setQuestion(
        nextStep === 5 && scenario
          ? `Apply the rule to this scenario: ${scenario}`
          : `Step ${nextStep}: ${RECITATION_STEPS[nextStep - 1]}`,
      );
      persist({
        feature: "recitation-drill",
        topicId,
        step: nextStep,
        attemptCount: 0,
        answers: nextAnswers,
        scores: nextScores,
        phase: "answering",
        updatedAt: new Date().toISOString(),
      });
    } else {
      const nextAttempt = attemptCount + 1;
      setAttemptCount(nextAttempt);
      setAnswers(nextAnswers);
      setScores(nextScores);
      persist({
        feature: "recitation-drill",
        topicId,
        step,
        attemptCount: nextAttempt,
        answers: nextAnswers,
        scores: nextScores,
        phase: "answering",
        updatedAt: new Date().toISOString(),
      });
    }

    // keep schedule check fresh if settings changed mid-session
    if (isPausedForClass(group, state.classSchedule)) setPaused(true);
  }

  if (paused) return <ClassPauseBanner />;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">Recitation drill</p>
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
        {isDemo && <DemoBanner />}
        <p className="mt-1 text-sm text-muted">
          Step {Math.min(step, 5)} of 5 — {RECITATION_STEPS[Math.min(step, 5) - 1]}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white/80 p-4">
        <p className="font-medium">Tutor</p>
        <p className="mt-2 leading-relaxed">{question}</p>
        {feedback && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
            {feedback}
          </p>
        )}
      </div>

      {!done && (
        <>
          <AnswerBox
            value={answer}
            onChange={setAnswer}
            maxLength={2000}
            disabled={busy}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="w-full rounded-md bg-accent px-4 py-3 text-white sm:w-auto"
          >
            {busy ? "Checking…" : "Send"}
          </button>
        </>
      )}

      {scores.length > 0 && (
        <div className="rounded-lg border border-line bg-white/70 p-4 text-sm">
          <p className="font-medium">Practice score</p>
          <ul className="mt-2 space-y-1">
            {scores.map((score, i) => (
              <li key={RECITATION_STEPS[i]}>
                {RECITATION_STEPS[i]}: {score}/2
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function RecitationPage() {
  return (
    <GroupGuard>
      <RecitationInner />
    </GroupGuard>
  );
}
