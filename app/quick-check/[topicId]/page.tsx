"use client";

import { useEffect, useState } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { groupForUrl, yearQuery } from "@/lib/profiles";
import { useParams, useRouter } from "next/navigation";
import { AnswerBox } from "@/components/AnswerBox";
import { GroupGuard } from "@/components/GroupGuard";
import { canUseFeature } from "@/lib/access";
import {
  clearActiveDrill,
  consumeRateLimit,
  loadState,
  saveActiveDrill,
} from "@/lib/storage";
import { callTutor, validateAnswerLength } from "@/lib/tutorClient";
import type { UserGroup } from "@/lib/types";

function QuickCheckInner() {
  const params = useParams<{ topicId: string }>();
  const router = useRouter();
  const topicId = params.topicId;

  const [group, setGroup] = useState<UserGroup | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [title, setTitle] = useState(topicId);
  const [isDemo, setIsDemo] = useState(false);
  const [question, setQuestion] = useState(
    "Type your own answer first. Feedback appears only after you send it.",
  );
  const [feedback, setFeedback] = useState("");
  const [answer, setAnswer] = useState("");
  const [exchangeCount, setExchangeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sources, setSources] = useState<
    { title: string; citation: string; link: string }[]
  >([]);

  useEffect(() => {
    const state = loadState();
    if (!state.userGroup) return;

    if (state.userGroup !== "year-3-4") {
      router.replace("/drills");
      return;
    }

    const ok = canUseFeature(
      state.userGroup,
      "in-class-quick-check",
      state.classSchedule,
    );
    setGroup(state.userGroup);
    setAllowed(ok);
    if (!ok) return;

    const existing =
      state.activeDrill?.feature === "in-class-quick-check" &&
      state.activeDrill.topicId === topicId
        ? state.activeDrill
        : null;

    fetch(`/api/topics?group=${groupForUrl(state.userGroup)}${yearQuery(state.studentYear)}&topicId=${topicId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.topic) {
          setTitle(data.topic.title);
          setIsDemo(Boolean(data.topic.isDemo));
        }
      });

    if (existing) {
      setExchangeCount(existing.exchangeCount ?? 0);
      setAnswer(existing.answers[0] ?? "");
      if ((existing.exchangeCount ?? 0) >= 2 || existing.phase === "quick-check-done") {
        setDone(true);
      }
      return;
    }

    void (async () => {
      const result = await callTutor({
        feature: "in-class-quick-check",
        topicId,
        userGroup: state.userGroup!,
        studentAnswer: "",
        action: "start",
      });
      if (result.ok) {
        setQuestion(
          result.data.nextQuestion ||
            "What is the issue and ruling, in your own words?",
        );
        setFeedback(result.data.feedback);
        saveActiveDrill({
          feature: "in-class-quick-check",
          topicId,
          step: 1,
          attemptCount: 0,
          answers: [],
          scores: [],
          phase: "quick-check",
          exchangeCount: 0,
          updatedAt: new Date().toISOString(),
        });
      }
    })();
  }, [topicId, router]);

  async function send() {
    if (!group || busy || done) return;
    const lengthError = validateAnswerLength("in-class-quick-check", answer);
    if (lengthError) {
      setFeedback(lengthError);
      return;
    }
    if (!consumeRateLimit().allowed) {
      setFeedback("You've reached 30 tutor messages this hour. Try again later.");
      return;
    }

    setBusy(true);
    const result = await callTutor(
      {
        feature: "in-class-quick-check",
        topicId,
        userGroup: group,
        studentAnswer: answer,
        exchangeCount,
        action: "answer",
      },
      { timeoutMs: 10_000 },
    );
    setBusy(false);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    const nextCount = exchangeCount + 1;
    setExchangeCount(nextCount);
    setFeedback(result.data.feedback);
    if (result.data.nextQuestion) setQuestion(result.data.nextQuestion);
    if (result.data.sources) setSources(result.data.sources);

    const finished = nextCount >= 2 || !result.data.nextQuestion;
    setDone(finished);
    if (finished) {
      clearActiveDrill();
    } else {
      saveActiveDrill({
        feature: "in-class-quick-check",
        topicId,
        step: 1,
        attemptCount: 0,
        answers: [answer],
        scores: [],
        phase: "quick-check",
        exchangeCount: nextCount,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (group && !allowed) {
    return (
      <p className="text-muted">
        Quick Check is only available for Year 3–4 students when allowed.
      </p>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">In-class Quick Check · 1–3 minutes</p>
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
        {isDemo && <DemoBanner />}
        <p className="mt-1 text-sm text-muted">
          Exchange {Math.min(exchangeCount + (done ? 0 : 1), 2)} of 2 · you answer
          first · not a script to read aloud
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white/80 p-4">
        <p className="leading-relaxed">{question}</p>
        {feedback && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
            {feedback}
          </p>
        )}
        {sources[0] && (
          <p className="mt-3 text-xs text-muted">
            Source: {sources[0].citation}{" "}
            <a className="underline" href={sources[0].link} target="_blank" rel="noreferrer">
              Open link
            </a>
          </p>
        )}
      </div>

      {!done && (
        <>
          <AnswerBox
            value={answer}
            onChange={setAnswer}
            maxLength={1000}
            disabled={busy}
            label="Your recitation answer (required before feedback)"
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

      {done && (
        <p className="rounded-md border border-line bg-white/70 p-3 text-sm">
          Quick Check complete. Return to class with the citation — not a script.
        </p>
      )}
    </section>
  );
}

export default function QuickCheckPage() {
  return (
    <GroupGuard>
      <QuickCheckInner />
    </GroupGuard>
  );
}
