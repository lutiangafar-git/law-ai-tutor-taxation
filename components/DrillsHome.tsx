"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClassPauseBanner } from "@/components/ClassPauseBanner";
import { DemoBanner } from "@/components/DemoBanner";
import { FeatureCard } from "@/components/FeatureCard";
import { GroupGuard } from "@/components/GroupGuard";
import {
  getHomeFeatureOrder,
  isPausedForClass,
} from "@/lib/access";
import {
  loadState,
  markDiagnosticOffered,
  markDiagnosticCompleted,
} from "@/lib/storage";
import { useRouter } from "next/navigation";
import {
  categoryOf,
  categoryPath,
  displayLabel,
  groupForUrl,
  yearQuery,
  type Category,
} from "@/lib/profiles";
import type { Feature, UserGroup } from "@/lib/types";
import { SUBJECT } from "@/lib/subject";
import { SYLLABUS_LABEL } from "@/lib/barExam";
import {
  dueReviews,
  masteryPercent,
  pickNextProblemTopic,
  problemHistory,
  unseenCount,
  weakRecitationSteps,
  type PickReason,
} from "@/lib/adaptive";
import { RECITATION_STEPS } from "@/lib/prompts/recitation";
import {
  finishedTopicIds,
  isSequentialGroup,
  nextInSyllabus,
  diagnosticRequired,
  remainingDiagnostic,
  topicSteps,
} from "@/lib/topicOrder";

type TopicSummary = {
  topicId: string;
  title: string;
  subject: string;
  lastReviewed: string;
  isDemo?: boolean;
  syllabusRef?: string;
};

const CATEGORY_TITLE: Record<Category, string> = {
  "year-1-2": "Year 1–2 drills",
  "year-3-4": "Year 3–4 drills",
  bar: "Bar review drills",
};

/** " · quiz mastery 75%" from the student's latest quiz on the topic, or "" if none yet. */
function masteryLabel(results: { topicId: string; firstTry: number; total: number }[] | undefined, topicId: string): string {
  const last = [...(results ?? [])].reverse().find((r) => r.topicId === topicId);
  return last ? ` · quiz mastery ${masteryPercent(last.firstTry, last.total)}%` : "";
}

function HomeInner({ category }: { category: Category }) {
  const router = useRouter();
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [paused, setPaused] = useState(false);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  /** Year 3–4 and bar: why this topic was picked (new, confirm, oldest). */
  const [pickReason, setPickReason] = useState<PickReason | null>(null);
  const [resumeHref, setResumeHref] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticTopics, setDiagnosticTopics] = useState<TopicSummary[]>([]);
  const [profileLabel, setProfileLabel] = useState("");
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ReturnType<typeof loadState> | null>(null);
  const [mustDiagnose, setMustDiagnose] = useState(false);
  const [diagnosticLeft, setDiagnosticLeft] = useState<string[]>([]);

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;
    // Each category has its own page; send the user to theirs.
    if (categoryOf(state.userGroup) !== category) {
      router.replace(categoryPath(state.userGroup));
      return;
    }

    const now = new Date();
    setGroup(state.userGroup);
    setProfileLabel(displayLabel(state.userGroup, state.studentYear));
    setPaused(isPausedForClass(state.userGroup, state.classSchedule, now));
    setFeatures(
      getHomeFeatureOrder(state.userGroup, state.classSchedule, now),
    );

    if (state.activeDrill) {
      const map: Record<Feature, string> = {
        "objective-quiz": `/quiz/${state.activeDrill.topicId}`,
        "recitation-drill": `/recitation/${state.activeDrill.topicId}`,
        "in-class-quick-check": `/quick-check/${state.activeDrill.topicId}`,
        "problem-drill": `/problem/${state.activeDrill.topicId}`,
      };
      setResumeHref(map[state.activeDrill.feature]);
    }

    fetch(`/api/topics?group=${groupForUrl(state.userGroup)}${yearQuery(state.studentYear)}`)
      .then((r) => r.json())
      .then((data: { topics: TopicSummary[] }) => {
        const list = data.topics ?? [];
        setTopics(list);
        const done = finishedTopicIds(state);
        setProgress(state);
        const required = diagnosticRequired(state.userGroup, state.diagnosticCompleted);
        setMustDiagnose(required);
        if (required && state.diagnosticOffered) {
          setDiagnosticLeft(remainingDiagnostic(state.diagnosticTopicIds, state.problemScores));
        }
        setFinished(done);
        // Year 1–2: next unfinished topic in syllabus order.
        // Others: a topic not done yet first (no needless repeats), see lib/adaptive.ts.
        if (isSequentialGroup(state.userGroup)) {
          const start = nextInSyllabus(list, done) ?? list[0];
          if (start) setSelectedTopic(start.topicId);
        } else {
          const pick = pickNextProblemTopic(list, state.problemScores, null);
          if (pick) {
            setSelectedTopic(pick.topic.topicId);
            setPickReason(pick.reason);
          }
        }

        const isRepeater = state.userGroup === "bar-repeater";
        const isFirstTime = state.userGroup === "bar-first-time";
        if (
          (isRepeater && !state.diagnosticCompleted && !state.diagnosticOffered) ||
          (isFirstTime && !state.diagnosticOffered && !state.diagnosticCompleted)
        ) {
          // Diagnostic: one problem from each of up to three different subjects.
          const seen = new Set<string>();
          const pick = (data.topics ?? [])
            .filter((t) => (seen.has(t.subject) ? false : (seen.add(t.subject), true)))
            .slice(0, 3);
          setDiagnosticTopics(pick);
          setShowDiagnostic(isRepeater || isFirstTime);
        }
      })
      .catch(() => setTopics([]));
  }, [category, router]);

  const selectedIsDemo = topics.find((t) => t.topicId === selectedTopic)?.isDemo ?? false;
  const sequential = isSequentialGroup(group);
  const nextTopic = sequential ? nextInSyllabus(topics, finished) : null;
  const finishedCount = topics.filter((t) => finished.has(t.topicId)).length;

  function randomTopic() {
    const pick = pickNextProblemTopic(topics, progress?.problemScores ?? [], selectedTopic);
    if (pick) {
      setSelectedTopic(pick.topic.topicId);
      setPickReason(pick.reason);
    }
  }

  const history = problemHistory(progress?.problemScores ?? []);
  const unseen = unseenCount(topics, progress?.problemScores ?? []);
  const pickedHistory = history.get(selectedTopic);
  const pickNote =
    pickReason === "new"
      ? "🆕 New to you."
      : pickReason === "confirm"
        ? `🔁 Back to confirm: your last score here was ${pickedHistory?.lastPoints ?? "?"}/5.`
        : pickReason === "oldest"
          ? "You have done every topic. This is the one you did longest ago."
          : "";

  const subjects = useMemo(() => {
    return Array.from(new Set(topics.map((t) => t.subject)));
  }, [topics]);

  function startDiagnostic() {
    const ids = diagnosticTopics.map((t) => t.topicId);
    markDiagnosticOffered(ids);
    setShowDiagnostic(false);
    if (ids[0]) {
      window.location.href = `/problem/${ids[0]}?diagnostic=1`;
    }
  }

  function skipDiagnostic() {
    markDiagnosticOffered([]);
    if (group === "bar-first-time") markDiagnosticCompleted();
    setShowDiagnostic(false);
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{CATEGORY_TITLE[category]}</h1>
        <p className="mt-1 text-sm font-medium uppercase tracking-wide text-accent">{SUBJECT.subjectName}</p>
        <p className="mt-2 max-w-2xl text-muted">
          Socratic drills grounded in reviewed Philippine sources. Only features
          allowed for your group right now are shown.
        </p>
        {profileLabel && (
          <p className="mt-2 text-sm">
            Practicing as <strong>{profileLabel}</strong> ·{" "}
            <Link href="/?register=1" className="text-accent underline">
              Change
            </Link>
          </p>
        )}
      </div>

      {resumeHref && (
        <Link
          href={resumeHref}
          className="block rounded-lg border border-accent bg-accent-soft/40 px-4 py-3 font-medium text-accent"
        >
          Continue where you left off
        </Link>
      )}

      {paused ? (
        <ClassPauseBanner />
      ) : (
        <>
          {showDiagnostic && (
            <div className="rounded-lg border border-line bg-white/80 p-4">
              <h2 className="font-display text-xl">
                Start with a short diagnostic
              </h2>
              <p className="mt-2 text-sm text-muted">
                Three short problem drills across the subject to find weak spots
                before regular practice.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startDiagnostic}
                  className="rounded-md bg-accent px-4 py-2 text-white"
                  disabled={diagnosticTopics.length === 0}
                >
                  Start diagnostic
                </button>
                {!mustDiagnose && (
                  <button
                    type="button"
                    onClick={skipDiagnostic}
                    className="rounded-md border border-line px-4 py-2"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </div>
          )}

          {mustDiagnose && !showDiagnostic && diagnosticLeft.length > 0 && (
            <div className="rounded-lg border border-line bg-white/80 p-4">
              <h2 className="font-display text-xl">Continue your diagnostic</h2>
              <p className="mt-2 text-sm text-muted">
                Finish the diagnostic first; your regular drills open right after.
              </p>
              <Link
                href={`/problem/${diagnosticLeft[0]}?diagnostic=1`}
                className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-white"
              >
                Continue diagnostic
              </Link>
            </div>
          )}

          {!mustDiagnose && (
          <>
          <div className="space-y-3">
            <h2 className="font-display text-xl">Choose a topic</h2>
            {sequential && progress && dueReviews(progress.quizReview ?? []).length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-300 bg-sky-50 p-3" role="status">
                <p className="text-sm">
                  🔁 <strong>
                    {dueReviews(progress.quizReview ?? []).length}{" "}
                    {dueReviews(progress.quizReview ?? []).length === 1 ? "question" : "questions"} to review today
                  </strong>{" "}
                  from quizzes you took before. A short review helps the law stick.
                </p>
                <Link href="/review-missed" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
                  Review now
                </Link>
              </div>
            )}
            {topics.length === 0 ? (
              <p className="rounded-md border border-line bg-white/70 p-4 text-sm text-muted">
                No topics are available for your year yet. Topics appear once a
                law-trained reviewer signs off their source file.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {subjects.length === 1 ? "Subject" : "Subjects"}: {subjects.join(" · ")}
                </p>
                {sequential ? (
                  <p className="rounded-md border border-line bg-white/70 p-3 text-sm">
                    Year 1–2 topics follow the {SYLLABUS_LABEL} in order. {finishedCount} of {topics.length}{" "}
                    finished (quiz + problem drill).{" "}
                    {nextTopic ? (
                      <>
                        Next up: <strong>{nextTopic.title}</strong>
                        {nextTopic.syllabusRef ? ` (syllabus ${nextTopic.syllabusRef})` : ""}.
                      </>
                    ) : (
                      <>You have finished every topic. Pick any topic to review.</>
                    )}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted">
                      {unseen} of {topics.length} topics are new to you. New ones come first; a problem you scored
                      below 4/5 comes back after 3 days to confirm.
                    </p>
                    <button
                      type="button"
                      onClick={randomTopic}
                      className="rounded-md border border-accent px-3 py-2 text-sm font-medium text-accent"
                    >
                      Next topic
                    </button>
                    {pickNote && <p className="w-full text-sm" role="status">{pickNote}</p>}
                  </div>
                )}
                <select
                  className="w-full rounded-md border border-line bg-white px-3 py-3"
                  value={selectedTopic}
                  onChange={(e) => {
                    setSelectedTopic(e.target.value);
                    setPickReason(null);
                  }}
                >
                  {subjects.map((subject) => (
                    <optgroup key={subject} label={subject}>
                      {topics
                        .filter((topic) => topic.subject === subject)
                        .map((topic) => (
                          <option key={topic.topicId} value={topic.topicId}>
                            {sequential && finished.has(topic.topicId) ? "✓ " : ""}
                            {topic.title}
                            {topic.isDemo ? " (demo)" : ""}
                            {sequential && progress ? masteryLabel(progress.quizResults, topic.topicId) : ""}
                            {progress && weakRecitationSteps(progress.recitationScores, topic.topicId).length > 0
                              ? ` · weak step: ${weakRecitationSteps(progress.recitationScores, topic.topicId)
                                  .map((n) => RECITATION_STEPS[n - 1])
                                  .join(", ")}`
                              : ""}
                            {!sequential && history.has(topic.topicId)
                              ? ` · done, last score ${history.get(topic.topicId)?.lastPoints ?? "?"}/5`
                              : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {selectedIsDemo && <DemoBanner />}
              </>
            )}
          </div>

          {selectedTopic && features.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl">Start a drill</h2>
              <div className="grid gap-3">
                {features.map((feature, index) => {
                  const steps = progress ? topicSteps(group, selectedTopic, progress) : null;
                  const st =
                    steps && feature !== "in-class-quick-check" ? steps[feature] : undefined;
                  return (
                    <FeatureCard
                      key={feature}
                      feature={feature}
                      topicId={selectedTopic}
                      lead={index === 0}
                      step={sequential && st ? index + 1 : undefined}
                      done={st?.done}
                      locked={st?.locked}
                      lockReason={st?.lockReason}
                    />
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
        </>
      )}
    </section>
  );
}

export function DrillsHome({ category }: { category: Category }) {
  return (
    <GroupGuard>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <HomeInner category={category} />
      </Suspense>
    </GroupGuard>
  );
}
