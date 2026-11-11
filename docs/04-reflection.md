# Reflection: Building Law AI Tutor

**Gafar Lutian · Week 4 Graded Mini Project 4.2 · November 2026**

## What I built
Law AI Tutor is a live web app (https://law-ai-tutor-taxation.vercel.app) that helps Philippine law students and bar
reviewees practice Taxation Law by answering first. It scores bar-style answers on Answer, Legal basis,
Application and Conclusion, coaches the weakest part, and uses only reviewed source files. It pauses itself
for Year 1–2 students during class, which matches the direction schools like UP Law are taking on AI.

## Key learnings
1. **Validation changed what I built.** My research started with three markets (students, reviewees and
   lawyers). The skeptical-VC step showed that this was "three companies", and the biggest risk was student
   behavior, not technology. So v1 is one subject (Taxation Law), text only, with no lawyers and no accounts,
   and Experiment 1 tests whether reviewees will pay before I build more.
2. **The spec is the product.** Writing usage rules as a table and as "Given / When / Then" criteria made
   them easy for the AI coding tools to build and easy to test. When the code and the spec disagreed, I
   fixed the code, not the spec, unless the spec itself was wrong. Then I logged the change.
3. **Grounding is a design choice, not a prompt trick.** Keeping legal content in separate files that only
   a reviewer signs off, and sending the model only one topic's file, is what lets the tutor say "that's
   outside the reviewed materials" instead of inventing a case. I tested this live: asked for a G.R. number
   that wasn't in the sources, it declined.
4. **Let the AI judge, but let code count.** Bar-coach feedback samples showed AI scores can be inconsistent; one
   gave 25/25 to an essay answering a different question. So the tutor now only labels each ALAC part (correct,
   incorrect, not stated), and a fixed 5-point rubric in code turns the labels into the score, with one test per row.
5. **AI-assisted coding still needs a human in the loop.** Cursor and Claude Code wrote most of the code,
   but I had to review each change, run the tests, and check the app in a browser. That is how the
   duplicate-problem bug and the wrong subject order were found, which the tests alone had missed.

## Challenges
- **No reviewed content at launch.** My own rule hides any topic a lawyer hasn't signed off, so the first
  deployment had an empty topic list. I added "demo" topics drawn from past bar questions, with a visible
  "pending lawyer review" banner, so the app works without pretending the content is verified.
- **Legal accuracy of sources.** A suggested answer in the bar Q&A compilation treated the spouse as
  preterited, but Art. 854 only covers heirs in the direct line. That reminded me why every topic needs
  lawyer review, and why I flagged it for the reviewer instead of copying it.
- **Time zones.** Class hours had to be checked in Manila time even though Vercel's servers run on UTC.
- **Learning the toolchain** (Git, GitHub Actions, Vercel, environment variables) as a non-developer. Small
  commits, and asking the AI to explain each step in plain English, made it manageable.
- **Copyright.** I used public law text and Supreme Court bar questions, but wrote my own model answers
  rather than copying a reviewer's suggested answers into a public repository.

## What I would improve in v2
1. **Lawyer sign-off and the accuracy gate:** 30 reviewed sessions with zero fabricated citations before any pilot.
2. **Server-side usage limit** (today the 30-per-hour limit is per device).
3. **Clearer drill screens (UI-1, UI-2):** separate question and feedback cards, and reviewer-approved key terms highlighted.
4. **More topics** per Taxation Law subject, then other bar subjects, using the same source-file format.
5. **Run Experiment 1** with 30–50 bar reviewees and measure completion, paid conversion and unaided mock scores.
6. Later: voice recitation practice, and an optional account so progress follows the student from Year 1 to the bar.

## If I did it again
I would load real, signed-off content before the first deployment, and set up the README and CI on day one
rather than at the end. Both are cheap early and stressful late.
