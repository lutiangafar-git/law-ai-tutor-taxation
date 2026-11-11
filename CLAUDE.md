# CLAUDE.md: Law AI Tutor - Taxation, Socratic Practice Drills

> The "onboarding note" every AI coding tool reads before touching this project.
> `CLAUDE.md` (Claude Code), `agents.md` (other agents) and `.cursorrules` (Cursor) hold the same rules. Keep them in sync.

## Project Overview
One Socratic law tutor whose rules change by user group:

| Group | Inside the classroom | Outside the classroom |
|---|---|---|
| Year 1–2 students | Not allowed (paused during class hours) | Drills to prepare for future recitations and exams |
| Year 3–4 students | In-class Quick Check to aid recitations | Drills to prepare for exams |
| Bar reviewees (first-time and repeaters) | Anytime | Anytime |

Content is **Taxation Law only**, limited to the Syllabus for the 2027 Bar Examinations (Commercial and Taxation Laws, Taxation Law part (VII)) and mapped to
the year it is taught: Year 3 General Principles, National Taxation (income tax, VAT, estate and donor's taxes), Local Taxation and Real Property Tax, Tax Remedies and the Court of Tax Appeals; Year 4 and bar reviewees all Taxation Law. Year 1 and Year 2 have no Taxation subject, so they are not offered. Customs is not in the 2027 Bar syllabus and is left out. The year plan lives in `/lib/subject.ts`; years with no topics
are hidden. Usage rules still work in pairs (Year 1–2, Year 3–4). This app is one of three sister apps
(Civil, Commercial, Taxation) with identical code; only `lib/subject.ts`, `sources/` and docs differ.
Never put another subject's topics here.

There are four features:
- **Objective and multiple-choice quiz:** Year 1–2 only. Checked in code; hints until correct.
- **Recitation drill:** facts → issue → rule → reasoning → application.
- **In-class Quick Check:** Year 3–4 only, 1–3 minutes, the student answers first.
- **Problem drill:** scored on Answer, Legal basis, Application and Conclusion, with coaching on the weakest
  element, a retry, and weak-spot tracking.

The tutor asks before it tells, uses only reviewed Philippine sources, and lets users resume anytime.
Full requirements are in `spec.md`. Follow it. If the code and the spec disagree, the spec wins.

## Tech Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS for all styling
- Anthropic Claude API
- Vitest for tests
- Deployed on Vercel

## Commands
- Start on my computer: `npm run dev` (then open http://localhost:3000)
- Run tests: `npm test`
- Check code style: `npm run lint`
- Check types: `npx tsc --noEmit`
- Production build (what Vercel runs): `npm run build`
- CI (GitHub Actions) runs all four plus a Gitleaks secret scan on every push. Keep it green.

## Architecture (where things live)
- `/app/page.tsx` + `/components/LandingClient.tsx`: page 1 with one Register button; registration steps
  (category → year, or "taken the Bar before?") → usage notice → the category's page.
- `/app/year-1-2`, `/app/year-3-4`, `/app/bar` + `/components/DrillsHome.tsx`: one drills page per category. Shows only
  the features allowed for the user's group and the current time. `/app/drills` redirects to the right one.
- `/app/onboarding/page.tsx`: old address, redirects to the landing page
- **Repeater status is confidential.** Never show "repeater" or "first-time" on screen (use `displayLabel()`), and
  never put it in a URL (use `groupForUrl()`, which sends "bar").
- `/app/recitation/[topicId]/page.tsx`: recitation drill
- `/app/quick-check/[topicId]/page.tsx`: In-class Quick Check (Year 3–4 only)
- `/app/problem/[topicId]/page.tsx`: problem drill (exam prep and bar)
- `/app/progress/page.tsx`: practice scores and weak spots
- `/app/settings/page.tsx`: group and class schedule
- `/app/api/tutor/route.ts`: server code that calls Claude (the only place the API key is used)
- `/app/api/topics/route.ts`: topic list for a group and year (never sends model answers)
- `/app/api/health/route.ts`: health check for monitoring (never returns the key)
- `/lib/access.ts`: **the single place for usage rules.** Given the group and the time, it decides which
  features are allowed.
- `/lib/subject.ts`: **this app's subject**: name, subject areas in syllabus order, and which areas each year sees
- `/lib/profiles.ts`: the Year 1–4 and bar choices (built from `subject.ts`), each mapped to a usage group
- `/lib/quiz.ts` + `/app/api/quiz/route.ts` + `/app/quiz/[topicId]/page.tsx`: Year 1–2 objective and multiple-choice
  quiz, checked in code (no AI call); hints, then narrowing, until the student is correct
- `/lib/topicOrder.ts`: syllabus order (`syllabusRef`) for Year 1–2, random topics for Year 3–4 and bar reviewees
- `/lib/monitoring.ts`: one JSON log line per Claude call (no student text)
- `/components/DemoBanner.tsx`: "Demo content: pending lawyer review" banner
- `/lib/rubric.ts`: 5-point bar-coach rubric (ALAC labels → 0–5 Practice score)
- `/lib/problemScoring.ts`: turns Claude's labels into the scorecard and re-scores retries
- `/lib/prompts/`: tutor instructions for each feature
- `/lib/sources.ts`: loads `sources/*.md`, hides unreviewed non-demo topics, filters by year, orders by subject
- `/lib/storage.ts`: saves group, schedule, progress and scores in the browser only
- `/sources/`: reviewed legal source files, one per topic (see `_TEMPLATE.md`)
- `/tests/`: automated tests, one group per acceptance criterion in spec.md
- `/docs/`: idea validation report, PRD, architecture notes, reflection, demo script

## Legal content rules
- Problems are **original bar-style problems** written for this app from the law and the reviewers. Note the past
  bar exam that raised the same issue. Never copy a reviewer's suggested answer; write model answers fresh.
- Statutes (RA, CA, PD, EO) are checked against LawPhil (lawphil.net); Supreme Court decisions against the SC
  website (sc.judiciary.gov.ph) or LawPhil. Never cite a case or G.R. number that hasn't been checked.
- Topics must fall within the 2027 Bar syllabus (laws and jurisprudence as of June 30, 2026).
- **Drill only, no open chat.** The app asks; the student answers. Never add a free-form "ask the tutor anything"
  chat. A student's question during a drill gets a hint or a Socratic question, never a lecture or a full answer.

## Conventions
- Make small, focused changes. Explain what you changed and why, in plain English. I'm not a developer.
- Every acceptance criterion in spec.md gets at least one test. `/lib/access.ts` needs a test for every
  group at class time and outside class time.
- Check layouts at 360 pixels wide (phone) and on a laptop.
- If something in the spec is unclear, ask me a question instead of guessing.

## Critical Constraints
- Usage rules live only in `/lib/access.ts`. Never weaken them:
  - Year 1–2 are always paused during class hours.
  - Quick Check is never shown to Year 1–2.
- NEVER edit a signed-off file in `/sources/` (one with `reviewedBy` and `lastReviewed`). Only a law-trained
  reviewer changes legal content. An AI tool may draft a NEW topic file only when the owner asks, and it
  must carry `status: demo` with `reviewedBy` and `lastReviewed` left empty, so the app shows the demo banner.
- NEVER write legal content (case names, G.R. numbers, articles, quotes) into code or prompts.
  All legal content must come from `/sources/`.
- The tutor must never invent citations. If information isn't in the sources, it says so.
- Quick Check must require the student's answer first and must not produce a script to read aloud.
- Label all scores "Practice score". Never describe them as official bar grading or pass predictions.
- Problem-drill scores come only from `/lib/rubric.ts` (5-point bar-coach rubric). The AI labels ALAC parts;
  it never sets the number. Every rubric row keeps a test in `tests/rubric.test.ts`.
- NEVER put the API key in code. Read it from `process.env.ANTHROPIC_API_KEY`.
- NEVER commit `.env.local`. It must stay listed in `.gitignore`.
- Never log student answers. Monitoring logs may contain only feature, model, latency and outcome.
- No login, database, voice, payments or dashboards in v1. Those are out of scope.
- Do not change `spec.md` without asking me.
