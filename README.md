# Law AI Tutor - Taxation: Socratic Taxation Law Practice

[![CI](https://github.com/lutiangafar-git/law-ai-tutor-taxation/actions/workflows/test.yml/badge.svg)](https://github.com/lutiangafar-git/law-ai-tutor-taxation/actions/workflows/test.yml)

**Live app:** https://law-ai-tutor-taxation.vercel.app
**Demo video (2 min):** _link added at submission_
**Course:** Week 4 Graded Mini Project 4.2, AI-Powered Web Application

An AI tutor for **Philippine law students and bar reviewees** in **Taxation Law** that makes you **answer first**, then scores your
bar-style answer on **Answer, Legal basis, Application and Conclusion (ALAC)**, coaches the weakest part, and
uses **only reviewed Philippine sources**. It never invents a citation. Its usage rules follow school AI
policies: Year 1–2 students are paused during class hours, and Year 3–4 students get a quick in-class check.

> **Why:** UP Law restricted AI in first-year core subjects in 2026, citing weaker reasoning. About 54% of 2025
> bar examinees were repeaters or refreshers, and general chatbots give answers away and can invent
> Philippine citations. See the [validation report](docs/01-idea-validation-report.md).

## What it does

| Who | Taxation Law topics | When |
|---|---|---|
| Year 3 student | General Principles and National (Internal Revenue) Taxation; Local Taxation and Real Property Tax; Tax Remedies and the Court of Tax Appeals | In class (Quick Check) and after |
| Year 4 student | All Taxation Law topics in the 2027 Bar syllabus | In class (Quick Check) and after |
| Bar reviewee (first-time or repeater) | All Taxation Law topics in the 2027 Bar syllabus | Anytime; repeaters start with a diagnostic |

**Landing page first.** Every visit starts with *"Who are you practicing as?"*. The student picks their law
school year or bar review status, and only then goes to the drills page for that year's topics. Years with
no Taxation Law topics are not offered. Topics are limited to the **Syllabus for the 2027 Bar Examinations
(Commercial and Taxation Laws, Taxation Law part (VII))**, Bar Bulletin No. 1-2027. **Year 1–2** work through their topics in syllabus order (the drills
page suggests the next unfinished one); **Year 3–4 and bar reviewees** get random topics to test general knowledge.

**Year 1–2 only: objective and multiple-choice quiz.** Four short questions per topic, checked by the app
itself (no AI call, so it is instant and free). Each wrong try brings the next hint; once the hints run out,
wrong options are removed or the answer's first letters are shown, so every student reaches the right answer.
Year 3–4 and bar reviewees don't get objective questions: they practise essay-style answers only.

**Three AI features**
1. **Recitation drill:** five Socratic steps (facts → issue → rule → reasoning → application), each scored 0–2. Asking "just tell me" gets you a hint, not the answer.
2. **In-class Quick Check (Year 3–4 only):** type your recitation first, then get one reply with what's right, what's missing and the citation. It never writes a script to read aloud.
3. **Problem drill:** an **original bar-style problem** written for this app (the past bar exam that raised the same issue is noted) → **Practice score out of 5** → coaching on your first weak ALAC part → rewrite → re-score → model answer. Weak spots are tracked across drills.

**How problem drills are scored (5-point bar-coach rubric, organised by ALAC).** Claude only *labels* each part
of your answer (correct / incorrect / not stated) and checks that you answered the question actually asked. The
score is then computed in code (`lib/rubric.ts`), so the same labels always give the same score:

| Points | Answer (conclusion) | Legal basis (rule) | Application |
|---|---|---|---|
| 5 | correct | correct | correct |
| 4 | correct | correct | incorrect or missing |
| 3 | correct · or incorrect | incorrect (but applied) · or correct | stated · or misapplied |
| 2 | correct · or incorrect | incorrect | not applied · or applied |
| 1 | incorrect · or any | stated but not applied · or **no rule** (facts only) | missing · or any |
| 0 | **no conclusion**, or an answer to a different issue | any | any |

**Trust rules:** the AI sees only the topic's source file. Questions outside it get *"That's outside the
reviewed materials for this drill."* Every score is labelled **"Practice score"**, never official bar grading.

> ⚠️ **Demo content.** The seven current topics (Constitution Art. VI Sec. 28(3)–(4); NIRC Secs. 39(A)(1), 105 and 228; LGC Secs. 195 and 234; RA 9282 Secs. 7 and 11) are marked **"Demo content: pending lawyer
> review"** in the app until a law-trained reviewer signs them off. Do not rely on them as legal advice.

## Sister apps
- **Law AI Tutor - Civil**: https://law-tutor-drill.vercel.app
- **Law AI Tutor - Commercial**: https://law-ai-tutor-commercial.vercel.app
- **Law AI Tutor - Taxation** (this app): https://law-ai-tutor-taxation.vercel.app

## Tech stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Anthropic Claude API (`claude-haiku-5-5` for fast turns,
`claude-sonnet-5-5` for ALAC labelling) · Vitest · GitHub Actions · Vercel (hosting and Web Analytics).
No database and no login: progress stays in the user's browser.

## Run it on your computer
Requirements: Node.js 20+ and an Anthropic API key.

```bash
git clone https://github.com/lutiangafar-git/law-ai-tutor-taxation.git
cd law-tutor-drill
npm install
cp .env.example .env.local      # then paste your key after ANTHROPIC_API_KEY=
npm run dev                     # open http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm test` | Run the 75 automated tests (the Claude API is faked; no key needed) |
| `npm run lint` | Check code style |
| `npx tsc --noEmit` | Check types |
| `npm run build` | Production build (what Vercel runs) |

## Environment variables and secrets

| Variable | Where it lives | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` on your computer (git-ignored) and Vercel → Settings → Environment Variables | `app/api/tutor/route.ts` only, on the server |

There are no secrets in the code or the Git history. `.env*.local` is git-ignored, `.env.example` is an empty
template, and CI runs a **Gitleaks** scan over the full history on every push. The key is never sent to the browser.

## CI/CD
- **GitHub Actions** ([`.github/workflows/test.yml`](.github/workflows/test.yml)), on every push and pull request: lint → typecheck → 75 tests → production build, plus a Gitleaks secret scan.
- **Vercel** deploys `main` automatically to https://law-ai-tutor-taxation.vercel.app after each push.
- **Monitoring:** Vercel Web Analytics (page views, no cookies); one JSON log line per Claude call (feature, model, latency, outcome; never student text) in Vercel → Logs; health check at [`/api/health`](https://law-ai-tutor-taxation.vercel.app/api/health).

## Project documents
| Document | What's in it |
|---|---|
| [docs/01-idea-validation-report.md](docs/01-idea-validation-report.md) | All 7 validation steps with evidence, "why now" and target user |
| [docs/02-prd.md](docs/02-prd.md) | One-page PRD with acceptance criteria for each feature |
| [spec.md](spec.md) | Full spec: context, inputs/outputs, behavior rules, constraints, 58 acceptance criteria, revision log |
| [docs/03-architecture.md](docs/03-architecture.md) | Architecture diagram, data flow, design decisions, security |
| [CLAUDE.md](CLAUDE.md) · [agents.md](agents.md) · [.cursorrules](.cursorrules) | Rules for AI coding tools (Claude Code, other agents, Cursor) |
| [docs/04-reflection.md](docs/04-reflection.md) | What I learned, challenges, v2 improvements |
| [docs/05-demo-script.md](docs/05-demo-script.md) | Script for the 2-minute demo |

## Project structure
```
app/            pages (landing, drills, recitation, quick check, problem, progress, settings) + API routes (tutor, topics, health)
components/     UI pieces (DemoBanner, FeatureCard, AnswerBox, ClassPauseBanner, GroupGuard)
lib/            subject settings (subject.ts), access rules, year profiles, topic loader, prompts, on-device storage, monitoring
sources/        one Markdown file per topic: legal text, key points, fact pattern, bar-style problem, model answer
tests/          Vitest tests mapped to the spec's acceptance criteria
docs/           validation, PRD, architecture, reflection, demo script
```

## Adding or reviewing a topic
Copy `sources/_TEMPLATE.md`, fill in every section, and set `yearLevels` to match the year plan in `lib/subject.ts` (e.g. `[year-3, year-4, bar]`).
While it is unreviewed, add `status: demo`. A law-trained reviewer then fills `reviewedBy` and `lastReviewed`
and deletes `status: demo`. A file with neither is hidden. `npm test` checks that every topic file is complete.

## Known limitations (v1)
- Content is seven demo topics in Taxation Law; lawyer sign-off is pending.
- The 30-messages-per-hour limit is per device, not per server (to fix before a real pilot).
- The user's group is self-declared (honor system); school-managed settings come later.
- Progress doesn't sync across devices (no accounts, by design).

v2 ideas are tracked in [GitHub Issues](https://github.com/lutiangafar-git/law-ai-tutor-taxation/issues).

## How AI was used to build this
The spec, rules files and code were written with **Cursor** and **Claude Code**, following `CLAUDE.md`. All
code changes were reviewed, tested (`npm test`) and committed in small steps. Legal content is kept apart
from code, in `sources/`, for human review.
