"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { GroupGuard } from "@/components/GroupGuard";
import { QuizQuestion } from "@/components/QuizQuestion";
import { canUseFeature, isPausedForClass } from "@/lib/access";
import { dueReviews, type ReviewItem } from "@/lib/adaptive";
import { groupForUrl, yearQuery } from "@/lib/profiles";
import type { ClientQuizItem } from "@/lib/quiz";
import { loadState, recordReviewAnswer, updateState } from "@/lib/storage";

type Due = ReviewItem & { item: ClientQuizItem; title: string };

/**
 * Year 1–2 spaced review: questions the student missed come back after 1, 3 and 7 days.
 * Right on the first try moves a question to the next wait; wrong starts it over at 1 day.
 */
function ReviewInner() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [due, setDue] = useState<Due[] | null>(null);
  const [pos, setPos] = useState(0);
  const [firstTryRight, setFirstTryRight] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;
    const now = new Date();
    setPaused(isPausedForClass(state.userGroup, state.classSchedule, now));
    const ok = canUseFeature(state.userGroup, "objective-quiz", state.classSchedule, now);
    setAllowed(ok);
    if (!ok) return;

    const list = dueReviews(state.quizReview, now);
    const topicIds = [...new Set(list.map((r) => r.topicId))];
    Promise.all(
      topicIds.map((id) =>
        fetch(`/api/quiz?group=${groupForUrl(state.userGroup)}${yearQuery(state.studentYear)}&topicId=${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { topic?: { title: string }; items?: ClientQuizItem[] } | null) => [id, d] as const)
          .catch(() => [id, null] as const),
      ),
    )
      .then((pairs) => {
        const byTopic = new Map(pairs);
        const ready: Due[] = [];
        const gone: ReviewItem[] = [];
        for (const r of list) {
          const d = byTopic.get(r.topicId);
          const item = d?.items?.[r.itemIndex];
          if (item) ready.push({ ...r, item, title: d?.topic?.title ?? "" });
          else if (d === null) continue; // network trouble: keep it for next time
          else gone.push(r); // topic or question no longer offered: drop it
        }
        if (gone.length > 0) {
          updateState((prev) => ({
            ...prev,
            quizReview: prev.quizReview.filter(
              (q) => !gone.some((g) => g.topicId === q.topicId && g.itemIndex === q.itemIndex),
            ),
          }));
        }
        setDue(ready);
      })
      .catch(() => setMessage("Review is unavailable right now. Try again in a minute."));
  }, []);

  if (paused) return <ClassPauseBanner />;
  if (allowed === false) {
    return (
      <p className="rounded-md border border-line bg-white/70 p-4 text-sm text-muted">
        Question review is for Year 1 and Year 2 students.{" "}
        <Link className="text-accent underline" href="/drills">
          Back to drills
        </Link>
      </p>
    );
  }
  if (message) return <p className="rounded-md border border-line bg-white/70 p-4 text-sm">{message}</p>;
  if (!due) return <p className="text-muted">Loading…</p>;

  if (pos >= due.length) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-3xl">{due.length === 0 ? "Nothing to review today" : "Review done"}</h1>
        {due.length > 0 && (
          <p>
            {firstTryRight} of {due.length} right on the first try. Those move to a longer wait; the others come back
            tomorrow.
          </p>
        )}
        {due.length === 0 && <p>Questions you miss in a quiz come back here after 1, 3 and 7 days.</p>}
        <Link className="inline-block rounded-md bg-accent px-4 py-2 text-white" href="/drills">
          Back to drills
        </Link>
      </section>
    );
  }

  const r = due[pos];
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">
          🔁 Review · {pos + 1} of {due.length}
        </p>
        <h1 className="font-display text-2xl">{r.title}</h1>
      </div>
      <QuizQuestion
        key={`${r.topicId}-${r.itemIndex}`}
        topicId={r.topicId}
        itemIndex={r.itemIndex}
        item={r.item}
        label={`Missed before · back after ${r.box === 1 ? "1 day" : r.box === 2 ? "3 days" : "7 days"}`}
        shuffleSeed={r.itemIndex * 104729 + r.misses + r.box}
        nextLabel={pos + 1 >= due.length ? "Finish review" : "Next"}
        onNext={(wrongTries) => {
          recordReviewAnswer(r.topicId, r.itemIndex, wrongTries === 0);
          if (wrongTries === 0) setFirstTryRight((n) => n + 1);
          setPos((p) => p + 1);
        }}
      />
    </section>
  );
}

export default function ReviewMissedPage() {
  return (
    <GroupGuard>
      <ReviewInner />
    </GroupGuard>
  );
}
