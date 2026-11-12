"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { DemoBanner } from "@/components/DemoBanner";
import { GroupGuard } from "@/components/GroupGuard";
import { QuizQuestion } from "@/components/QuizQuestion";
import { canUseFeature, isPausedForClass } from "@/lib/access";
import { masteryPercent, missedOnFirstPass, nextRetryQueue, REVIEW_INTERVAL_DAYS } from "@/lib/adaptive";
import { groupForUrl, yearQuery } from "@/lib/profiles";
import type { ClientQuizItem } from "@/lib/quiz";
import {
  addQuizResult,
  clearActiveDrill,
  loadState,
  saveActiveDrill,
  scheduleMissedQuestions,
} from "@/lib/storage";
import type { StudentYear } from "@/lib/types";

/**
 * Year 1–2 objective and multiple-choice quiz, in three parts:
 * 1. every question once (hints on each wrong try; tried answers greyed out);
 * 2. a second chance on every question missed, choices in a new order, until each is right;
 * 3. the missed questions go on the spaced-review list (back in 1, then 3, then 7 days).
 */
function QuizInner() {
  const { topicId } = useParams<{ topicId: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [year, setYear] = useState<StudentYear | null>(null);
  const [title, setTitle] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [items, setItems] = useState<ClientQuizItem[]>([]);
  const [message, setMessage] = useState("");
  /** First pass: position, and wrong tries per question. */
  const [index, setIndex] = useState(0);
  const [firstPass, setFirstPass] = useState<number[]>([]);
  /** Second chance: questions still to re-ask, and goes used per question. */
  const [retry, setRetry] = useState<number[] | null>(null);
  const [retryRounds, setRetryRounds] = useState<Record<number, number>>({});
  const [retryTurn, setRetryTurn] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;
    const now = new Date();
    setYear(state.studentYear);
    setPaused(isPausedForClass(state.userGroup, state.classSchedule, now));
    const ok = canUseFeature(state.userGroup, "objective-quiz", state.classSchedule, now);
    setAllowed(ok);
    if (!ok) return;

    fetch(`/api/quiz?group=${groupForUrl(state.userGroup)}${yearQuery(state.studentYear)}&topicId=${topicId}`)
      .then((r) => r.json())
      .then((data: { topic?: { title: string; isDemo: boolean }; items?: ClientQuizItem[] }) => {
        if (!data.items) {
          setMessage("There is no quiz for this topic yet.");
          return;
        }
        setTitle(data.topic?.title ?? "");
        setIsDemo(Boolean(data.topic?.isDemo));
        setItems(data.items);
        const saved =
          state.activeDrill?.feature === "objective-quiz" && state.activeDrill.topicId === topicId
            ? state.activeDrill
            : null;
        if (saved && saved.step < data.items.length) {
          setIndex(saved.step);
          setFirstPass(saved.scores);
        }
      })
      .catch(() => setMessage("The quiz is unavailable right now. Try again in a minute."));
  }, [topicId]);

  function finish(pass: number[]) {
    setDone(true);
    clearActiveDrill();
    addQuizResult({
      topicId,
      firstTry: pass.filter((n) => n === 0).length,
      total: items.length,
      finishedAt: new Date().toISOString(),
    });
    scheduleMissedQuestions(topicId, missedOnFirstPass(pass));
  }

  function nextFirstPass(wrongTries: number) {
    const pass = [...firstPass, wrongTries];
    setFirstPass(pass);
    if (index + 1 < items.length) {
      setIndex(index + 1);
      saveActiveDrill({
        feature: "objective-quiz",
        topicId,
        step: index + 1,
        attemptCount: 0,
        answers: [],
        scores: pass,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const missed = missedOnFirstPass(pass);
    if (missed.length === 0) finish(pass);
    else setRetry(missed);
  }

  function nextRetry(wrongTries: number) {
    if (!retry) return;
    const current = retry[0];
    const queue = nextRetryQueue(retry, current, wrongTries === 0, retryRounds);
    setRetryRounds((r) => ({ ...r, [current]: (r[current] ?? 0) + 1 }));
    setRetryTurn((t) => t + 1);
    if (queue.length === 0) finish(firstPass);
    else setRetry(queue);
  }

  if (paused) return <ClassPauseBanner />;
  if (allowed === false) {
    return (
      <p className="rounded-md border border-line bg-white/70 p-4 text-sm text-muted">
        The objective and multiple-choice quiz is for Year 1 and Year 2 students. Use the recitation and
        problem drills instead. <Link className="text-accent underline" href="/drills">Back to drills</Link>
      </p>
    );
  }

  if (done) {
    const firstTry = firstPass.filter((n) => n === 0).length;
    const missed = missedOnFirstPass(firstPass).length;
    const mastery = masteryPercent(firstTry, items.length);
    return (
      <section className="space-y-4">
        <h1 className="font-display text-3xl">Quiz complete</h1>
        <div className="rounded-lg border border-line bg-white/80 p-4">
          <p className="text-sm text-muted">Mastery on this topic</p>
          <p className="font-display text-4xl text-accent">{mastery}%</p>
          <p className="text-sm">
            {firstTry} of {items.length} right on the first try.
            {missed > 0 && ` You then got the other ${missed === 1 ? "one" : missed} right on a second chance.`}
          </p>
        </div>
        {missed > 0 ? (
          <p className="text-sm">
            🔁 {missed === 1 ? "The question you missed comes" : `The ${missed} questions you missed come`} back for a
            short review in {REVIEW_INTERVAL_DAYS[0]} day, then {REVIEW_INTERVAL_DAYS[1]} and {REVIEW_INTERVAL_DAYS[2]}{" "}
            days, until you get {missed === 1 ? "it" : "them"} right each time.
          </p>
        ) : (
          <p className="text-sm">Every question right on the first try. Nothing to review on this topic.</p>
        )}
        <p className="text-sm text-muted">Practice only. This is not a grade.</p>
        <div className="flex flex-wrap gap-3">
          <Link className="rounded-md bg-accent px-4 py-2 text-white" href={`/recitation/${topicId}`}>
            Next: Step 2, Recitation
          </Link>
          <Link className="rounded-md border border-line px-4 py-2" href="/drills">
            Back to drills
          </Link>
        </div>
      </section>
    );
  }

  const inRetry = retry !== null;
  const qIndex = inRetry ? retry[0] : index;
  const item = items[qIndex];

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">
          Objective & multiple-choice quiz{year ? ` · Year ${year}` : ""}
        </p>
        <h1 className="font-display text-2xl">{title || "Loading…"}</h1>
      </div>
      {isDemo && <DemoBanner />}
      {message && (
        <p role="status" className="rounded-md border border-line bg-white/70 p-3 text-sm">
          {message}
        </p>
      )}
      {inRetry && (
        <p className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm" role="status">
          🔁 <strong>Second chance.</strong> Let&apos;s try again the {retry.length === 1 ? "question" : "questions"} you
          missed, with the choices in a new order. {retry.length} to go.
        </p>
      )}
      {item && (
        <QuizQuestion
          key={`${inRetry ? "r" : "f"}-${qIndex}-${retryTurn}`}
          topicId={topicId}
          itemIndex={qIndex}
          item={item}
          label={
            inRetry
              ? `Second chance · Question ${qIndex + 1}`
              : `Question ${index + 1} of ${items.length} · ${
                  item.kind === "multiple-choice" ? "Multiple choice" : "Objective (type a short answer)"
                }`
          }
          shuffleSeed={inRetry ? qIndex * 7919 + retryTurn + 1 : undefined}
          nextLabel={
            inRetry
              ? "Next"
              : index + 1 >= items.length
                ? "Finish quiz"
                : "Next question"
          }
          onNext={inRetry ? nextRetry : nextFirstPass}
        />
      )}
    </section>
  );
}

export default function QuizPage() {
  return (
    <GroupGuard>
      <QuizInner />
    </GroupGuard>
  );
}
