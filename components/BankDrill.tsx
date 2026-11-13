"use client";

import { useEffect, useMemo, useState } from "react";
import { normalise, type BankQuestion, type OutlineItem } from "@/lib/bankShared";

const MAX_TRIES = 3;
const YEARS = ["All", "Y1", "Y2", "Y3"] as const;

/** "What are you studying now?" - pick an area and a topic from the syllabus outline, then drill. */
export function BankDrill({ outline }: { outline: OutlineItem[] }) {
  const [year, setYear] = useState<(typeof YEARS)[number]>("All");
  const [area, setArea] = useState("");
  const [line, setLine] = useState("");
  const [kind, setKind] = useState<"all" | "basic" | "bar">("all");
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const titleOf = useMemo(() => new Map(outline.map((o) => [o.code, o.title])), [outline]);
  const inYear = (o: OutlineItem) => year === "All" || o.year === year;
  const areas = outline.filter((o) => o.level === 1 && outline.some((x) => x.leaf && inYear(x) && x.code.startsWith(o.code + ".")));
  const lines = area ? outline.filter((o) => o.leaf && o.count > 0 && inYear(o) && o.code.startsWith(area + ".")) : [];

  async function start() {
    const code = line || area;
    if (!code) return;
    setLoading(true);
    const res = await fetch(`/api/bank?code=${encodeURIComponent(code)}&kind=${kind}`);
    const data = (await res.json()) as { questions: BankQuestion[] };
    const qs = data.questions.filter((q) => year === "All" || outline.find((o) => o.code === q.ref)?.year === year);
    setQuestions(qs);
    setIndex(0);
    setLoading(false);
  }

  if (questions) {
    const q = questions[index];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <button className="underline hover:text-accent" onClick={() => setQuestions(null)}>
            ← Choose another topic
          </button>
          <span>
            Question {index + 1} of {questions.length}
          </span>
        </div>
        {q ? (
          <QuestionCard key={q.id} q={q} lineTitle={titleOf.get(q.ref) ?? ""} />
        ) : (
          <p className="text-muted">No questions for this choice yet.</p>
        )}
        <div className="flex justify-between">
          <button
            className="rounded-md border border-line px-4 py-2 disabled:opacity-40"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </button>
          <button
            className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-40"
            disabled={index >= questions.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next question
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-line bg-white/70 p-4">
      <h2 className="font-display text-xl text-ink">What are you studying now?</h2>
      <label className="block text-sm text-muted">
        Year level
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          value={year}
          onChange={(e) => {
            setYear(e.target.value as (typeof YEARS)[number]);
            setArea("");
            setLine("");
          }}
        >
          {YEARS.filter((y) => y === "All" || outline.some((o) => o.leaf && o.year === y)).map((y) => (
            <option key={y} value={y}>
              {y === "All" ? "All years (Year 4 and bar review)" : `Year ${y.slice(1)} topics`}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-muted">
        Area
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setLine("");
          }}
        >
          <option value="">Choose an area…</option>
          {areas.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code}. {a.title}
            </option>
          ))}
        </select>
      </label>
      {area && (
        <label className="block text-sm text-muted">
          Topic (syllabus line)
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            <option value="">All topics in this area (exam prep)</option>
            {lines.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code} {l.title} ({l.course})
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="text-sm text-muted">
        <legend>Questions</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {(
            [
              ["all", "Basic and bar"],
              ["basic", "Basic only (short answer)"],
              ["bar", "Bar problems only (ALAC)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1 text-ink">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-50" disabled={!area || loading} onClick={start}>
        {loading ? "Loading…" : "Start drill"}
      </button>
    </div>
  );
}

function QuestionCard({ q, lineTitle }: { q: BankQuestion; lineTitle: string }) {
  const [tried, setTried] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [text, setText] = useState("");
  const [showModel, setShowModel] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const out = !solved && tried.length >= MAX_TRIES;
  const done = solved || out;
  const label = q.type === "bar" ? "Bar problem" : q.type === "mcq" ? "Multiple choice" : "Objective";

  function tryAnswer(answer: string) {
    if (done || !answer.trim()) return;
    const right =
      q.type === "mcq"
        ? answer === q.correct
        : (q.accept ?? []).some((a) => normalise(a) === normalise(answer));
    if (right) setSolved(true);
    else setTried((t) => [...t, answer]);
    setText("");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {q.ref} · {lineTitle} · {label}
      </p>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-lg text-ink">{q.q}</p>
      </div>

      {q.type === "mcq" && (
        <ul className="space-y-2">
          {(q.choices ?? []).map((c, i) => {
            const letter = "ABCD"[i];
            const wasTried = tried.includes(letter);
            const isAnswer = done && letter === q.correct;
            return (
              <li key={letter}>
                <button
                  disabled={done || wasTried}
                  onClick={() => tryAnswer(letter)}
                  className={`w-full rounded-md border px-3 py-3 text-left ${
                    isAnswer ? "border-green-500 bg-green-50" : wasTried ? "border-red-300 bg-red-50 text-gray-500 line-through" : "border-line bg-white hover:border-accent"
                  }`}
                >
                  {letter}) {c}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "objective" && !done && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tryAnswer(text);
          }}
        >
          <input
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer"
            aria-label="Your answer"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white">Check</button>
        </form>
      )}

      {q.type !== "bar" && !done && tried.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="status">
          <p className="font-semibold text-amber-900">
            Not yet. Try {MAX_TRIES - tried.length} more time{MAX_TRIES - tried.length === 1 ? "" : "s"}.
          </p>
          {q.hints?.[Math.min(tried.length, q.hints.length) - 1] && (
            <p className="mt-1 text-ink">Hint: {q.hints[Math.min(tried.length, q.hints.length) - 1]}</p>
          )}
        </div>
      )}

      {q.type !== "bar" && done && (
        <div className={`rounded-lg border p-3 text-sm ${solved ? "border-green-300 bg-green-50" : "border-line bg-white"}`} role="status">
          <p className="font-semibold text-ink">{solved ? "Correct!" : `The answer${q.type === "mcq" ? `: ${q.correct}` : `: ${q.accept?.[0]}`}`}</p>
          <p className="mt-1 text-ink">{q.why}</p>
          {!solved && <p className="mt-1 text-muted">This question will come back for review in 7 days (coming soon).</p>}
          <p className="mt-2 text-xs text-muted">Legal basis: {q.cite}</p>
        </div>
      )}

      {q.type === "bar" && (
        <div className="space-y-3">
          <textarea
            className="min-h-40 w-full rounded-md border border-line bg-white p-3"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your answer in four paragraphs: (Answer) (Legal basis) (Application) (Conclusion)"
            aria-label="Your bar answer"
          />
          {!showModel ? (
            <button className="rounded-md bg-accent px-4 py-2 text-white" onClick={() => setShowModel(true)}>
              Show model answer
            </button>
          ) : (
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Model answer</p>
              {q.alac &&
                (
                  [
                    ["Answer", q.alac.answer],
                    ["Legal basis", q.alac.basis],
                    ["Application", q.alac.application],
                    ["Conclusion", q.alac.conclusion],
                  ] as const
                ).map(([label, body]) => (
                  <p key={label} className="mb-3 font-serif text-ink" style={{ textIndent: "2.5em" }}>
                    ({label}) {body}
                  </p>
                ))}
              {q.keyPoints && (
                <div className="mt-2 text-sm">
                  <p className="font-semibold text-ink">Key points the examiner looks for</p>
                  <ul className="ml-5 list-disc text-ink">
                    {q.keyPoints.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">Legal basis: {q.cite}</p>
              {q.pastBar && q.pastBar.length > 0 && (
                <p className="text-xs text-muted">Similar issue in past Bar exams (to be confirmed): {q.pastBar.join(", ")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
