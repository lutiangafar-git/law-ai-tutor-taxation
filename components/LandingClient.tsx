"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsageNotice } from "@/lib/access";
import { loadState, markUsageNoticeSeen, setUserGroup } from "@/lib/storage";
import {
  barGroupFromHistory,
  categoryOptions,
  categoryPath,
  displayLabel,
  missingYears,
  type Category,
} from "@/lib/profiles";
import { SUBJECT } from "@/lib/subject";
import type { StudentYear, UserGroup } from "@/lib/types";

type Step = "start" | "category" | "year" | "bar" | "notice";

/**
 * Page 1: one "Register" button. Then: category → exact year (students) or
 * "Have you taken the Bar before?" (bar reviewees) → usage notice → that category's page.
 * Nothing leaves the device. Repeater status is never shown on screen.
 */
export function LandingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("start");
  const [category, setCategory] = useState<Category | null>(null);
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [savedLabel, setSavedLabel] = useState("");
  const [savedReady, setSavedReady] = useState(false);

  useEffect(() => {
    const state = loadState();
    // "Change my details" / "Register again" always starts at the category step.
    if (searchParams.get("register") === "1") {
      setStep("category");
      return;
    }
    if (state.userGroup) {
      setGroup(state.userGroup);
      setSavedLabel(displayLabel(state.userGroup, state.studentYear));
      setSavedReady(state.usageNoticeSeen);
      if (searchParams.get("notice") === "1" || !state.usageNoticeSeen) {
        setStep("notice");
        return;
      }
    }
  }, [searchParams]);

  const categories = categoryOptions();
  const chosen = categories.find((c) => c.key === category);

  function pickCategory(key: Category) {
    setCategory(key);
    setStep(key === "bar" ? "bar" : "year");
  }

  function register(newGroup: UserGroup, year: StudentYear | null) {
    setUserGroup(newGroup, year);
    setGroup(newGroup);
    setStep("notice");
  }

  function continueAfterNotice() {
    markUsageNoticeSeen();
    router.push(categoryPath(group));
  }

  const card =
    "w-full rounded-lg border border-line bg-white/80 px-4 py-4 text-left transition hover:border-accent hover:bg-accent-soft/40";
  const back = (to: Step) => (
    <button type="button" onClick={() => setStep(to)} className="text-sm text-muted underline">
      ← Back
    </button>
  );

  if (step === "notice" && group) {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-3xl text-ink">Before you start</h1>
        <p className="rounded-lg border border-line bg-white/70 p-4 text-base leading-relaxed">
          {getUsageNotice(group)}
        </p>
        <p className="text-sm text-muted">
          Never use this during exams, quizzes, proctored mock bars, or the bar exam itself. School and
          review-center rules come first.
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

  if (step === "category") {
    return (
      <section className="space-y-6">
        {back("start")}
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Register · step 1 of 2</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Which describes you?</h1>
        </div>
        <ul className="space-y-3" aria-label="Choose your category">
          {categories.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => pickCategory(c.key)} className={card}>
                <span className="block font-medium text-ink">{c.label}</span>
                <span className="mt-1 block text-sm text-muted">{c.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (step === "year" && chosen) {
    const missing = missingYears(chosen.key);
    return (
      <section className="space-y-6">
        {back("category")}
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Register · step 2 of 2</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Which year are you in?</h1>
          {missing.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {missing.map((y) => `Year ${y}`).join(" and ")} {missing.length > 1 ? "have" : "has"} no{" "}
              {SUBJECT.subjectName} subject, so {missing.length > 1 ? "they are" : "it is"} not listed.
            </p>
          )}
        </div>
        <ul className="space-y-3" aria-label="Choose your year">
          {chosen.years.map((y) => (
            <li key={y}>
              <button
                type="button"
                onClick={() => register(y <= 2 ? "year-1-2" : "year-3-4", y)}
                className={card}
              >
                <span className="block font-medium text-ink">Year {y}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (step === "bar") {
    return (
      <section className="space-y-6">
        {back("category")}
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Register · step 2 of 2</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Have you taken the Bar exam before?</h1>
          <p className="mt-2 text-sm text-muted">
            Your answer is private. It stays on this device, is never shown on screen, and only decides
            whether we suggest a short diagnostic first.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => register(barGroupFromHistory(false), null)} className={card}>
            <span className="block font-medium text-ink">No</span>
            <span className="mt-1 block text-sm text-muted">This will be my first time.</span>
          </button>
          <button type="button" onClick={() => register(barGroupFromHistory(true), null)} className={card}>
            <span className="block font-medium text-ink">Yes</span>
            <span className="mt-1 block text-sm text-muted">I have taken it before.</span>
          </button>
        </div>
      </section>
    );
  }

  // Page 1: one button.
  return (
    <section className="flex flex-col items-center gap-6 py-10 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {SUBJECT.subjectName} · 2027 Bar syllabus
      </p>
      <h1 className="font-display text-4xl text-ink">{SUBJECT.appName}</h1>
      <p className="max-w-md text-muted">
        Socratic drills: we ask, you answer, and you get coached on your weakest part.
      </p>
      {savedReady && savedLabel ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(categoryPath(group))}
            className="flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-lg font-medium text-white shadow"
          >
            <span aria-hidden="true">▶</span> Continue as {savedLabel}
          </button>
          <button type="button" onClick={() => setStep("category")} className="text-sm text-muted underline">
            Not you? Register again
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStep("category")}
          className="flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-lg font-medium text-white shadow"
        >
          <span aria-hidden="true" className="text-2xl leading-none">＋</span> Register
        </button>
      )}
      <p className="max-w-sm text-xs text-muted">
        No account or password: your details stay on this device only.
      </p>
    </section>
  );
}
