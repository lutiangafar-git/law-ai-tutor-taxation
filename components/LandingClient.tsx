"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsageNotice } from "@/lib/access";
import {
  loadState,
  markUsageNoticeSeen,
  setUserGroup,
} from "@/lib/storage";
import {
  PROFILE_OPTIONS,
  findProfile,
  type ProfileOption,
} from "@/lib/profiles";
import { SUBJECT } from "@/lib/subject";
import type { UserGroup } from "@/lib/types";

/**
 * Landing page: the student first says who they are (Year 1–4 or bar reviewee).
 * Once identified, they go to /drills for the questions and drills.
 * First-time choices (or a changed choice) see the usage notice first.
 */
export function LandingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<"choose" | "notice">("choose");
  const [saved, setSaved] = useState<ProfileOption | null>(null);
  const [savedNoticeSeen, setSavedNoticeSeen] = useState(false);

  useEffect(() => {
    const state = loadState();
    setSaved(findProfile(state.userGroup, state.studentYear));
    setSavedNoticeSeen(state.usageNoticeSeen);
    if (
      state.userGroup &&
      (searchParams.get("notice") === "1" || !state.usageNoticeSeen)
    ) {
      setGroup(state.userGroup);
      setNotice(getUsageNotice(state.userGroup));
      setStep("notice");
    }
  }, [searchParams]);

  function chooseGroup(option: ProfileOption) {
    if (saved?.key === option.key && savedNoticeSeen) {
      router.push("/drills");
      return;
    }
    setUserGroup(option.group, option.year);
    setGroup(option.group);
    setNotice(getUsageNotice(option.group));
    setStep("notice");
  }

  function continueAfterNotice() {
    markUsageNoticeSeen();
    router.push("/drills");
  }

  if (step === "notice" && notice && group) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-3xl text-ink">Before you start</h1>
        <p className="rounded-lg border border-line bg-white/70 p-4 text-base leading-relaxed">
          {notice}
        </p>
        <p className="text-sm text-muted">
          Never use this during exams, quizzes, proctored mock bars, or the bar
          exam itself. School and review-center rules come first.
        </p>
        <button
          type="button"
          onClick={continueAfterNotice}
          className="w-full rounded-md bg-accent px-4 py-3 text-base font-medium text-white sm:w-auto"
        >
          I understand — go to my drills
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">
          {SUBJECT.subjectName} · 2027 Bar syllabus
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">Who are you practicing as?</h1>
        <p className="mt-2 text-muted">
          Pick your law school year or bar review status. It decides which{" "}
          {SUBJECT.subjectName} topics and features you get next. You can change it
          anytime.
        </p>
      </div>

      {saved && savedNoticeSeen && (
        <button
          type="button"
          onClick={() => router.push("/drills")}
          className="w-full rounded-lg border border-accent bg-accent-soft/40 px-4 py-3 text-left font-medium text-accent"
        >
          Continue as {saved.label} →
        </button>
      )}

      <ul className="space-y-3" aria-label="Choose your year or bar review status">
        {PROFILE_OPTIONS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => chooseGroup(item)}
              aria-current={saved?.key === item.key ? "true" : undefined}
              className={`w-full rounded-lg border px-4 py-4 text-left transition hover:border-accent hover:bg-accent-soft/40 ${
                saved?.key === item.key
                  ? "border-accent bg-white"
                  : "border-line bg-white/80"
              }`}
            >
              <span className="block font-medium text-ink">{item.label}</span>
              <span className="mt-1 block text-sm text-muted">{item.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
