"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { DemoBanner } from "@/components/DemoBanner";
import { GroupGuard } from "@/components/GroupGuard";
import { canUseFeature, isPausedForClass } from "@/lib/access";
import { groupForUrl, yearQuery } from "@/lib/profiles";
import type { ClientQuizItem, QuizCheckResult } from "@/lib/quiz";
import { addQuizResult, clearActiveDrill, loadState, saveActiveDrill } from "@/lib/storage";
import type { StudentYear } from "@/lib/types";

/**
 * Year 1–2 objective and multiple-choice quiz. The student keeps answering each item until
 * correct; every wrong try brings the next hint (and, once hints run out, narrows the choices).
 */
function QuizInner() {
  const { topicId } = useParams<{ topicId: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [year, setYear] = useState<StudentYear | null>(null);
  const [title, setTitle] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [items, setItems] = useState<ClientQuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [wrongTries, setWrongTries] = useState(0);
  const [totalWrong, setTotalWrong] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizCheckResult | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  /** Wrong answers already tried on this question: greyed out and struck through. */
  const [tried, setTried] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
          setTotalWrong(saved.scores);
        }
      })
      .catch(() => setMessage("The quiz is unavailable right now. Try again in a minute."));
  }, [topicId]);

  const item = items[index];
  const solved = result?.correct === true;

  async function submit(choice?: string) {
    const given = (choice ?? answer).trim();
    if (!given) {
      setMessage(item?.kind === "multiple-choice" ? "Pick an option first." : "Type your answer first. A rough one is fine.");
      return;
    }
    if (busy || solved) return;
    setBusy(true);
    setMessage("");
    const state = loadState();
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userGroup: state.userGroup,
          studentYear: state.studentYear,
          topicId,
          itemIndex: index,
          answer: given,
          wrongTriesBefore: wrongTries,
          classSchedule: state.classSchedule,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "The quiz is unavailable right now. Try again in a minute.");
        return;
      }
      const check = data as QuizCheckResult;
      setResult(check);
      if (!check.correct) {
        setWrongTries((n) => n + 1);
        setTried((t) => (t.includes(given) ? t : [...t, given]));
        if (check.hint && !hints.includes(check.hint)) setHints((h) => [...h, check.hint!]);
      }
    } catch {
      setMessage("The quiz is unavailable right now. Your answer is still here, so try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const wrongLog = [...totalWrong, wrongTries];
    setTotalWrong(wrongLog);
    if (index + 1 >= items.length) {
      setDone(true);
      clearActiveDrill();
      addQuizResult({
        topicId,
        firstTry: wrongLog.filter((n) => n === 0).length,
        total: items.length,
        finishedAt: new Date().toISOString(),
      });
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setWrongTries(0);
    setAnswer("");
    setResult(null);
    setHints([]);
    setTried([]);
    saveActiveDrill({
      feature: "objective-quiz",
      topicId,
      step: nextIndex,
      attemptCount: 0,
      answers: [],
      scores: wrongLog,
      updatedAt: new Date().toISOString(),
    });
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
    const firstTry = totalWrong.filter((n) => n === 0).length;
    return (
      <section className="space-y-4">
        <h1 className="font-display text-3xl">Quiz complete</h1>
        <p>
          You answered all {items.length} questions correctly. {firstTry} of {items.length} were right on the first
          try.
        </p>
        <p className="text-sm text-muted">Practice only. This is not a grade.</p>
        <Link className="inline-block rounded-md bg-accent px-4 py-2 text-white" href="/drills">
          Back to drills
        </Link>
      </section>
    );
  }

  const eliminated = new Set(result?.eliminated ?? []);

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

      {item && (
        <>
          <p className="text-sm text-muted">
            Question {index + 1} of {items.length} ·{" "}
            {item.kind === "multiple-choice" ? "Multiple choice" : "Objective (type a short answer)"}
          </p>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Question</p>
            <p className="mt-1 text-lg font-medium text-ink">{item.question}</p>
          </div>

          {item.kind === "multiple-choice" ? (
            <ul className="space-y-2">
              {item.choices.map((c) => {
                const out = eliminated.has(c.key);
                const wasTried = tried.includes(c.key);
                const isAnswer = solved && result?.answer === c.key;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      disabled={busy || solved || out || wasTried}
                      onClick={() => {
                        setAnswer(c.key);
                        void submit(c.key);
                      }}
                      className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-3 text-left ${
                        isAnswer
                          ? "border-emerald-500 bg-emerald-50"
                          : wasTried
                            ? "border-red-200 bg-gray-100 text-gray-500"
                            : out
                              ? "border-line bg-white/40 text-muted line-through"
                              : "border-line bg-white hover:border-accent"
                      }`}
                    >
                      <span className={wasTried ? "line-through decoration-red-500" : undefined}>
                        <strong>{c.key})</strong> {c.text}
                      </span>
                      {wasTried && (
                        <span className="shrink-0 text-xs font-semibold text-red-700">✗ You tried this</span>
                      )}
                      {out && !wasTried && <span className="sr-only"> (removed)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="block text-sm text-muted" htmlFor="quiz-answer">
                Your answer
              </label>
              <input
                id="quiz-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={busy || solved}
                maxLength={200}
                autoComplete="off"
                className="w-full rounded-md border border-line bg-white px-3 py-3"
              />
              <button
                type="submit"
                disabled={busy || solved}
                className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
              >
                {busy ? "Checking…" : "Check"}
              </button>
              {tried.length > 0 && !solved && (
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-red-700">✗ You tried: </span>
                  {tried.map((t, i) => (
                    <span key={t}>
                      {i > 0 && ", "}
                      <span className="line-through decoration-red-500">{t}</span>
                    </span>
                  ))}
                </p>
              )}
            </form>
          )}

          {result && !solved && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4" role="status">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Not yet. Try again</p>
              {hints.map((h, i) => (
                <p key={i} className="mt-1 text-sm text-ink">
                  <strong>Hint {i + 1}:</strong> {h}
                </p>
              ))}
              {result.reveal && (
                <p className="mt-2 text-sm">
                  <strong>The answer starts with:</strong> {result.reveal}
                </p>
              )}
              {result.eliminated && result.eliminated.length > 0 && (
                <p className="mt-2 text-sm">Some wrong options were removed to help you.</p>
              )}
            </div>
          )}

          {solved && (
            <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4" role="status">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Correct</p>
              {item.kind === "objective" && result?.answer && (
                <p className="text-sm">
                  Answer: <strong>{result.answer}</strong>
                </p>
              )}
              {result?.explanation && <p className="text-sm text-ink">{result.explanation}</p>}
              <button type="button" onClick={next} className="rounded-md bg-accent px-4 py-2 text-white">
                {index + 1 >= items.length ? "Finish quiz" : "Next question"}
              </button>
            </div>
          )}
        </>
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
