"use client";

import { useEffect, useState } from "react";
import { GroupGuard } from "@/components/GroupGuard";
import { getWeakSpots, loadState } from "@/lib/storage";
import type { ProblemScoreRecord, StoredUserState } from "@/lib/types";

const ELEMENTS = ["Answer", "Legal basis", "Application", "Conclusion"] as const;

/** Weak-spot values: 2 = correct, 1 = stated but incorrect, 0 = not stated. */
const SCORE_SYMBOL: Record<number, string> = { 2: "✓", 1: "✗", 0: "–" };

function ProgressInner() {
  const [state, setState] = useState<StoredUserState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) {
    return <p className="text-muted">Loading…</p>;
  }

  const weak = getWeakSpots(state.problemScores, 10);
  const recentProblems: ProblemScoreRecord[] = state.problemScores.slice(-10).reverse();

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Progress</h1>
        <p className="mt-2 text-muted">
          Practice scores and weak spots stay on this device only. These are not
          official bar grades or pass predictions.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white/80 p-4">
        <h2 className="font-display text-xl">Weak spots</h2>
        {state.problemScores.length < 3 ? (
          <p className="mt-2 text-sm text-muted">
            Finish at least 3 problem drills to see your weakest ALAC element.
          </p>
        ) : weak[0] ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Lowest-scoring element across your last{" "}
              {Math.min(10, state.problemScores.length)} drills:{" "}
              <strong>{weak[0].element}</strong> (average {weak[0].average.toFixed(1)}/2,
              where 2 = correct, 1 = stated but incorrect, 0 = not stated).
            </p>
            <ul className="space-y-1 text-muted">
              {weak.map((item) => (
                <li key={item.element}>
                  {item.element}: {item.average.toFixed(1)}/2
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No problem scores yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl">Recent problem Practice scores</h2>
        {recentProblems.length === 0 ? (
          <p className="text-sm text-muted">No problem drills finished yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentProblems.map((item) => (
              <li
                key={`${item.topicId}-${item.finishedAt}`}
                className="rounded-md border border-line bg-white/70 px-3 py-3 text-sm"
              >
                <p className="font-medium">
                  {item.topicId}
                  {item.isDiagnostic ? " · Diagnostic" : ""}
                </p>
                <p className="mt-1 text-muted">
                  {typeof item.points === "number" && (
                    <strong className="text-ink">Practice score {item.points}/5 · </strong>
                  )}
                  {ELEMENTS.map(
                    (el) => `${el} ${SCORE_SYMBOL[item.scores[el]] ?? "–"}`,
                  ).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl">Recent recitation Practice scores</h2>
        {state.recitationScores.length === 0 ? (
          <p className="text-sm text-muted">No recitation drills finished yet.</p>
        ) : (
          <ul className="space-y-2">
            {state.recitationScores
              .slice(-10)
              .reverse()
              .map((item) => (
                <li
                  key={`${item.topicId}-${item.finishedAt}`}
                  className="rounded-md border border-line bg-white/70 px-3 py-3 text-sm"
                >
                  <p className="font-medium">{item.topicId}</p>
                  <p className="mt-1 text-muted">
                    Steps: {item.stepScores.map((s) => `${s}/2`).join(" · ")}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function ProgressPage() {
  return (
    <GroupGuard>
      <ProgressInner />
    </GroupGuard>
  );
}
