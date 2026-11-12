"use client";

import { useState } from "react";
import { shuffled } from "@/lib/adaptive";
import type { ClientQuizItem, QuizCheckResult } from "@/lib/quiz";
import { loadState } from "@/lib/storage";

/**
 * One Year 1–2 quiz question. The student keeps answering until correct: each wrong try brings
 * the next hint (then narrows the choices). Tried answers are greyed out and struck through.
 * Used by the topic quiz, its second-chance round, and the spaced-review page.
 * Give it a new `key` for each question so it starts fresh.
 */
export function QuizQuestion({
  topicId,
  itemIndex,
  item,
  label,
  shuffleSeed,
  nextLabel,
  onNext,
}: {
  topicId: string;
  itemIndex: number;
  item: ClientQuizItem;
  /** e.g. "Question 1 of 4 · Multiple choice" */
  label: string;
  /** When set, multiple-choice options are shown in a new (fixed) order. */
  shuffleSeed?: number;
  nextLabel: string;
  /** Called when the student moves on, with how many wrong tries they made. */
  onNext: (wrongTries: number) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizCheckResult | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [wrongTries, setWrongTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const solved = result?.correct === true;
  const choices = shuffleSeed !== undefined ? shuffled(item.choices, shuffleSeed) : item.choices;
  const eliminated = new Set(result?.eliminated ?? []);

  async function submit(choice?: string) {
    const given = (choice ?? answer).trim();
    if (!given) {
      setMessage(item.kind === "multiple-choice" ? "Pick an option first." : "Type your answer first. A rough one is fine.");
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
          itemIndex,
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

  return (
    <>
      <p className="text-sm text-muted">{label}</p>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Question</p>
        <p className="mt-1 text-lg font-medium text-ink">{item.question}</p>
      </div>
      {message && (
        <p role="status" className="rounded-md border border-line bg-white/70 p-3 text-sm">
          {message}
        </p>
      )}

      {item.kind === "multiple-choice" ? (
        <ul className="space-y-2">
          {choices.map((c, position) => {
            // Letters follow the order shown (A, B, C, D) even when shuffled; the real key is what is checked.
            const letter = String.fromCharCode(65 + position);
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
                    <strong>{letter})</strong> {c.text}
                  </span>
                  {wasTried && <span className="shrink-0 text-xs font-semibold text-red-700">✗ You tried this</span>}
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
          <button type="submit" disabled={busy || solved} className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
            {wrongTries === 0 ? "Correct" : "Correct now"}
          </p>
          {item.kind === "objective" && result?.answer && (
            <p className="text-sm">
              Answer: <strong>{result.answer}</strong>
            </p>
          )}
          {result?.explanation && <p className="text-sm text-ink">{result.explanation}</p>}
          <button type="button" onClick={() => onNext(wrongTries)} className="rounded-md bg-accent px-4 py-2 text-white">
            {nextLabel}
          </button>
        </div>
      )}
    </>
  );
}
