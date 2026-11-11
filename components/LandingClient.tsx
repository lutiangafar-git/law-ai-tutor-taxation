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

  // Page 1 (Design A, "classic law school"): one button, nothing else to choose.
  const pill =
    "inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-8 py-3 text-lg font-medium text-white transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <section className="flex flex-col items-center px-2 py-10 text-center sm:py-14">
      <ScalesIcon />
      <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">Law AI Tutor</h1>
      <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-accent">
        {SUBJECT.subjectName} · 2027 Bar syllabus
      </p>
      <div className="my-6 h-px w-16 bg-line" aria-hidden="true" />
      <blockquote className="max-w-md font-display text-xl italic leading-snug text-ink/80 sm:text-2xl">
        &ldquo;Answer first. Then learn why.&rdquo;
      </blockquote>
      <p className="mt-3 max-w-md text-sm text-muted">
        Socratic drills for Philippine law students and bar reviewees: we ask, you answer, and you are
        coached on your weakest part.
      </p>

      <div className="mt-8">
        {savedReady && savedLabel ? (
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={() => router.push(categoryPath(group))} className={pill}>
              Continue as {savedLabel}
            </button>
            <button type="button" onClick={() => setStep("category")} className="text-sm text-muted underline">
              Not you? Register again
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setStep("category")} className={pill}>
            <UserPlusIcon /> Register
          </button>
        )}
      </div>

      <ul className="mt-10 grid w-full max-w-lg grid-cols-1 gap-3 text-sm text-ink sm:grid-cols-3" aria-label="Why trust it">
        <li className="rounded-lg border border-line bg-white/70 px-3 py-3">
          <span className="block font-medium">2027 Bar syllabus</span>
          <span className="text-xs text-muted">Topics follow Bar Bulletin No. 1-2027</span>
        </li>
        <li className="rounded-lg border border-line bg-white/70 px-3 py-3">
          <span className="block font-medium">Reviewed sources</span>
          <span className="text-xs text-muted">Never invents a citation</span>
        </li>
        <li className="rounded-lg border border-line bg-white/70 px-3 py-3">
          <span className="block font-medium">Private</span>
          <span className="text-xs text-muted">No password; stays on your device</span>
        </li>
      </ul>
    </section>
  );
}

/** Scales of justice, drawn inline so no icon library is needed. */
function ScalesIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-accent"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M8 21h8" />
      <path d="M5 7h14" />
      <path d="M12 7l-1.2-1.6h2.4z" />
      <path d="M5 7l-3 6a3 3 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3 3 0 0 0 6 0z" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}
