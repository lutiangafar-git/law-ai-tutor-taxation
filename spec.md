# Spec: Law AI Tutor - Taxation, Socratic Practice Drills (v1)

> Worked example for Lab 1 (deck page 15) and Mini Project Phase 1 (deck page 60).
> Based on the Law AI Tutor research (problem statements, personas, VC critique).
> v1 serves all law students and all bar reviewees, but keeps the content narrow: **Taxation Law only, text only**, limited to the 2027 Bar syllabus.
> Revised 12 Nov 2026 (split into Civil, Commercial and Taxation apps). See the **Revision log** at the end.

## ⭐ When each group may use the tutor

| User group | Inside the classroom | Outside the classroom | Purpose |
|---|---|---|---|
| **Year 1 and 2 students** | ❌ **Not allowed.** The tutor pauses during the student's class hours. | ✅ Allowed | Practice after class to prepare for **future** recitations and exams |
| **Year 3 and 4 students** | ✅ Allowed: **In-class Quick Check** to aid recitations | ✅ Allowed | Aid recitations in class; prepare for exams outside class |
| **Bar reviewees** (first-time takers and repeaters) | ✅ Anytime | ✅ Anytime | Review and answer practice at any time of day |

**Applies to everyone:** never during exams, quizzes, proctored mock bars or the bar exam itself, and never
to write graded work. School, professor and review-center rules take priority over this table.

## 1. Context & Goal
Philippine law faculty report weaker reasoning as students lean on AI. UP Law now keeps first-year core
subjects offline as much as possible, while upper-year students need faster, deeper learning. Each year,
more than 13,000 bar applicants prepare for an all-essay exam, and about 54% of 2025 examinees were repeaters
or refreshers. General chatbots serve none of these groups well: they hand out answers and can get Philippine
law wrong, including invented citations.

Law AI Tutor - Taxation is one Socratic tutor that adjusts its rules to the user's stage:
- **Year 1–2 (persona: Miko):** build the basics after class through step-by-step questioning, so students
  can answer on their own when called in class or tested later.
- **Year 3–4 (persona: Bea):** check their reasoning quickly during class before or after reciting, and
  prepare for exams outside class.
- **Bar reviewees, first-time takers and repeaters (persona: Carla):** practice bar-style answers anytime,
  get feedback on how each answer is built, and track weak spots. Repeaters start with a diagnostic.

**Content for v1: Taxation Law, mapped to the year it is taught.** Scope is limited to the **Syllabus for the 2027 Bar
Examinations, Commercial and Taxation Laws, Taxation Law part (VII)** (Bar Bulletin No. 1-2027, 16 September 2026; laws and jurisprudence as of June 30, 2026).
The year plan is set in `lib/subject.ts`.

| User | Taxation Law topics shown | Topic tag in `sources/` |
|---|---|---|
| Year 3 student | General Principles and National (Internal Revenue) Taxation; Local Taxation and Real Property Tax; Tax Remedies and the Court of Tax Appeals | `year-3` |
| Year 4 student | All Taxation Law topics in the 2027 Bar syllabus | `year-4` |
| Bar reviewee (first-time or repeater) | All Taxation Law topics in the 2027 Bar syllabus | `bar` |

Usage rules still group years in pairs (Year 1–2, Year 3–4; see the table above). The exact year only
decides which topics appear. Year 1 and Year 2 have no Taxation Law subject, so the landing page does not offer them, and this app has no objective quiz (that feature is for Year 1–2). Customs law is left out because it is not in the 2027 Bar syllabus. In the 2027 Bar, Commercial and Taxation Laws are examined together (20%); Commercial has its own sister app. Problems are **original bar-style problems** written for this app from the law
and the subject reviewers; each notes the past Bar Examination that raised the same issue. Model answers are
written for this app in the ALAC format and never copied from a reviewer.

**Landing page and registration.** Page 1 shows one Register button (Continue for a returning user). Registering
asks for the category (Law student Year 1–2, Law student Year 3–4, Bar reviewee), then the exact year, or for bar
reviewees "Have you taken the Bar exam before?" (No → `bar-first-time`, Yes → `bar-repeater`). After the usage
notice the user lands on their category's page (`/year-1-2`, `/year-3-4`, `/bar`). Registration is on the device
only (no account or password in v1). **Repeater status is confidential:** it only decides the diagnostic; every
screen says "Bar reviewee", and web addresses carry `bar`, never the repeater status.

**Demo topics.** Until a law-trained reviewer signs off a topic file, it may be published with
`status: demo`. A demo topic appears with the banner "Demo content: pending lawyer review" on the home
screen and on every drill screen, and its source reference reads "Demo content: pending lawyer review"
instead of a reviewer's name. A file that is neither signed off nor marked demo stays hidden. All demo
topics must be signed off, or removed, before any real student pilot.

**Out of scope for v1:** lawyers, full timed mock bar exams, voice, logins, payments, school or coach dashboards.

## 2. Inputs & Outputs
**Inputs**
- `userGroup`: `year-1-2` | `year-3-4` | `bar-first-time` | `bar-repeater`. Chosen on the landing page and changeable there or in Settings.
- `studentYear` (students only): `1` | `2` | `3` | `4`. Chosen together with the group ("Year 1 student"…
  "Year 4 student"); decides which topics appear. Bar reviewees have no year.
- `classSchedule` (students only): class days and times, saved on the device. All times are Philippine time.
  **Pre-filled with the typical law school schedule**, which the student can edit or clear in Settings:
  - **Monday to Friday:** 6:00 PM to 9:00 PM
  - **Saturday and Sunday:** 8:00 AM to 6:00 PM
- `feature`: `objective-quiz` (Year 1–2 only) | `recitation-drill` | `in-class-quick-check` | `problem-drill`. Only features allowed for the
  user's group and the current time are offered.
- `topicId`: from the topic list. Only reviewed topics tagged for the user's group appear.
- `studentAnswer`: text in English, Filipino or Taglish.
  - Quick check: up to 1,000 characters.
  - Recitation drill: up to 2,000 characters.
  - Problem drill: up to 4,000 characters.
- `drillState`: current step, previous answers and past scores, saved on the device.

**Outputs, for each turn**
- `verdict`: `correct` | `partly correct` | `not yet`
- `feedback`: 1–3 sentences on what was right or missing, citing the source.
- `nextQuestion`: the next Socratic question, or a hint if the student is stuck.

**Output, at the end of a drill**
- `rubric`: recitation drills score each step 0–2. Problem drills return a **0–5 Practice score** from the
  5-point bar-coach rubric, plus each ALAC part labelled `correct` | `incorrect` | `missing` with a one-line note,
  up to two strengths and two gaps (see Section 3.2).
- `oneThingToFix`: one concrete improvement.
- `sources`: a list of `{ title, citation, link, reviewedBy, lastReviewed }`.
- Problem drills only, `weakSpots`: the answer elements that scored lowest across the last 10 drills.

**Data the tutor uses**
- `sources/` folder, one file per topic. Each file holds:
  - the reviewed source text, citation, link, reviewer and last-reviewed date
  - the year levels it applies to
  - quick-check key points
  - a recitation fact pattern
  - an exam or bar-style problem with a model answer

## 3. Behavior Rules
### 3.1 Usage rules by group (the table at the top, as behavior)
**Year 1–2: outside the classroom only**
- On first use, show: "Use this after class to prepare for your next recitations and exams. It isn't
  available during class, and it isn't for exams or graded work."
- If a class schedule is entered, **all** features pause during those hours: "It's class time. Come back
  after class to review." No AI call is made.
- The In-class Quick Check is never offered to this group.
- The objective and multiple-choice quiz is offered only to this group.

**Year 3–4: in the classroom and outside it**
- On first use, show: "During class, use Quick Check to test your reasoning for recitation. Outside class,
  use drills to prepare for exams. Follow your professor's rules. Never use it during exams or quizzes."
- During entered class hours, the home screen leads with **In-class Quick Check**. Full drills stay available.
- Outside class hours, the home screen leads with Recitation and Problem drills.

**Bar reviewees: anytime**
- No time restrictions. Recitation drills and Problem drills are available 24/7.
- On first use, show: "Practice anytime. Not for use during proctored mock exams (unless your review center
  allows it) or the bar exam itself."
- **Repeaters** are offered a short diagnostic first (3 problem drills across the subject) to find their
  weak spots. First-time takers can choose to take it.

**Everyone**
- Decline requests to write case digests, papers, memoranda or other graded work, and remind the user to
  follow their school's or review center's AI policy.
- v1 relies on the user's self-declared group (honor system). School-managed settings come later.

### 3.2 Features
**Objective and multiple-choice quiz (Year 1–2 only, outside class): 3–5 minutes**
Four short questions per topic (at least two multiple choice, two objective), written for the topic from its source
text. The app checks each answer itself; there is no AI call. Each wrong try shows the next hint. When the hints run
out, wrong options are removed (multiple choice) or the answer's first letters are shown (objective), so the student
keeps going until correct. The explanation appears once correct. Year 3–4 and bar reviewees don't get this quiz:
they practise essay-style answers only.

**Topic order.** Year 1–2 follow the 2027 Bar syllabus in order, one topic after another, and within each topic go
step by step: quiz → recitation (Socratic, step by step) → bar-style problem, each unlocking the next, so they are not
rushed into complicated questions but still practise the bar-style answers their exams use. Year 3–4 and bar reviewees
get random topics and bar-style problems immediately. Bar repeaters must finish the diagnostic first.

**Recitation drill (Year 1–4 and bar reviewees, outside class): 5–10 minutes**
Steps: 1. Facts or provision → 2. Issue → 3. Rule or ruling → 4. Reasoning → 5. Apply it to a short new fact pattern.
Each step scores 0 (missing or wrong), 1 (partly right) or 2 (complete and accurate).

**In-class Quick Check (Year 3–4 only): 1–3 minutes**
1. The student picks the topic being discussed and types their own answer first
   (e.g., the issue and ruling as they would recite it).
2. In one reply, the tutor says what's right, what's missing or wrong, and the source citation.
   It doesn't write a script to read aloud.
3. Optionally, one follow-up question the professor might ask. The check ends after at most 2 exchanges.

**Problem drill (Year 1–4 exam prep and bar reviewees): 10–20 minutes**
1. Show an exam or bar-style problem from the topic's source file.
2. The student writes a full answer.
3. Score the answer with the **5-point bar-coach rubric**, organised by ALAC (adapted from a bar-review
   coaching rubric; ALAC confirmed by a bar coach):
   - **Answer** = the conclusion · **Legal basis** = the rule · **Application** = the rule applied to these facts ·
     **Conclusion** = the closing statement (a structure check; it stands in for the Answer only if no opening Answer is given).
   - The AI **only labels** each part `correct`, `incorrect` or `missing`, and says whether the answer addresses the
     issue actually asked (`responsive`). A real rule that does not decide this issue is `incorrect`; stating only facts
     as the basis means the rule is `missing`.
   - The app turns the labels into points with fixed rules (`/lib/rubric.ts`). The AI never chooses the number.

   | Points | Conclusion (Answer) | Rule (Legal basis) | Application |
   |---|---|---|---|
   | 5 | correct | correct | correct |
   | 4 | correct | correct | incorrect or not stated |
   | 3 | (a) correct · (b) incorrect | (a) incorrect · (b) correct | (a) stated · (b) incorrect |
   | 2 | (a) correct · (b) incorrect | (a) incorrect · (b) incorrect | (a) not stated · (b) stated |
   | 1 | (a) incorrect · (b) correct or incorrect | (a) stated · (b) **not stated** (facts only) | (a) not stated · (b) any |
   | 0 | **not stated**, or the answer addresses a different issue from the one asked | any | any |

4. Show the score with its one-line reason, each ALAC part (✓ correct, ✗ incorrect, – not stated) with a short note,
   and up to two strengths and two gaps.
5. Coach the **first part, in ALAC order, that isn't correct**, with Socratic questions only. The student rewrites that
   part, and the score is recomputed from the updated labels.
6. Show the model answer and source only after the retry, or immediately if every part is already correct (5/5).

### 3.3 Socratic first (all features)
- **Drill only.** The app asks and the student answers. There is no open chat where the student asks the app
  questions; students have other apps for that, and this one specialises in drills.
- Every drill opens with a question or problem, never an explanation.
- The tutor never gives a full answer before the student has tried.
- If the student asks "just tell me", the tutor gives a hint, not the answer.
- After 2 unsuccessful attempts at the same step, the tutor reveals that step's answer with its citation and moves on.

### 3.4 Grounded and accurate
- Every legal statement in feedback must come from the topic's source file and show its citation.
- The tutor never invents case names, G.R. numbers, article numbers, dates or quotes.
- If the user asks about something outside the topic's sources, reply:
  "That's outside the reviewed materials for this drill. Check the official source or ask your professor or coach."
- Topics whose source file has no `reviewedBy` or `lastReviewed` are hidden, unless the file is marked
  `status: demo`, in which case it is shown with the demo banner (see Section 1).

### 3.5 Private, judgment-free, resumable
- Feedback stays encouraging and specific. Never compare a user with others.
- Scores and weak spots are visible only to the user on their own device.
- Progress is saved after every turn, and "Continue where you left off" restores the exact step.
- All results are labelled "Practice score". Never claim official bar grading or predict bar results.

### 3.6 Edge cases
- Empty answer → no AI call. Show "Type your answer first. A rough one is fine."
- Answer over the length limit → ask the user to shorten it.
- AI unavailable or slower than 30 seconds (10 seconds for Quick Check) → "The tutor is unavailable right
  now. Your answer is saved, so try again in a minute." The typed answer is never lost.
- Never show technical error messages.

## 4. Constraints
- **Tech stack:** Next.js + TypeScript + Tailwind CSS. AI: Anthropic Claude API. Hosting: Vercel.
- **Model and cost:**
  - Use a fast, lower-cost Claude model for Quick Checks and recitation drills.
  - Problem-drill scoring may use a stronger model if testing shows it's needed.
  - Keep usage at or under about ₱5 per 15-minute session.
- **Speed:** a Quick Check reply should arrive within about 5 seconds, so it's usable in class.
- **Time zone:** all class times are Philippine time (Asia/Manila), whatever time zone the server or device runs in.
- **Secrets:** the API key lives only in the `ANTHROPIC_API_KEY` environment variable. Never in code or on GitHub.
- **Usage limit:** 30 tutor messages per hour per device.
- **Devices:** usable on a 360-pixel-wide phone screen (Quick Checks, short drills) and on a laptop (long answers).
- **Legal content:** only reviewed files in `sources/` count. The app and AI coding tools must not edit them.
- **Privacy:** no names, emails or accounts in v1. Group, schedule, progress and scores are stored only in
  the user's browser. Answers are not stored on the server after the reply is sent.
- **Simplicity:** no database and no login in v1.

## 5. Acceptance Criteria
**All groups**
1. Given any topic, when a drill starts, then the first tutor message is a question or a problem, not an explanation.
2. Given step 1 of a drill, when the user types "just give me the answer", then the tutor gives a hint and
   doesn't reveal the answer.
3. Given two unsuccessful attempts at the same step, then the tutor reveals that step's answer with its
   citation and link and moves on.
4. Given the topic "Civil Code, Article 1156: definition of an obligation", when the user asks about a
   Supreme Court case not in the sources, then the tutor replies with the outside-materials message and no
   citation is invented.
5. Given a user closes the app mid-drill, when they reopen it, then "Continue where you left off" returns
   them to the same step with earlier answers intact.
6. Given an empty answer, when the user taps Send, then no AI call is made.
7. Given the AI service is down, when the user sends an answer, then the friendly message appears and the
   typed answer is still in the box.
8. Given a source file without `lastReviewed`, then that topic doesn't appear.
9. Given a user chooses their group for the first time, then that group's usage notice (Section 3.1) is
   shown before the first drill.

**Usage rules by group**

10. Given a Year 1–2 user with a class schedule of Monday 6:00–9:00 PM, when they open any feature on
    Monday at 7:00 PM, then the class-time pause message is shown and no AI call is made.
11. Given a Year 1–2 user at any time, then the In-class Quick Check is never shown.
12. Given a Year 3–4 user with a class schedule of Monday 6:00–9:00 PM, when they open the app on Monday
    at 7:00 PM, then In-class Quick Check is the first option on the home screen.
13. Given a Year 3–4 Quick Check, then the student must type their answer before any feedback appears.
    The feedback includes a citation, and the check ends within 2 exchanges.
14. Given a bar reviewee (first-time or repeater), when they open any drill at any hour on any day, then it
    is available with no class-time pause.
15. Given any group, when the user asks "write my case digest for class", then the tutor declines and
    mentions the school's AI policy.

**Problem drills**

16. Given a submitted answer, then the tutor shows a 0–5 Practice score and labels Answer, Legal basis,
    Application and Conclusion before showing any model answer (unless the score is 5/5).
17. Given the first part that isn't correct is Legal basis, then the follow-up questions are about Legal basis
    only, and the user is asked to rewrite it.
18. Given 3 or more finished problem drills, then the weak-spots summary names the lowest-scoring element.
19. Given any score, then it is labelled "Practice score", and nothing mentions official bar grading or pass predictions.
20. Given a bar repeater on first use, then the diagnostic is offered before regular drills.

**Release**

21. Given a 360-pixel-wide screen, then all buttons and text are usable without sideways scrolling.
22. **Accuracy gate:** before release, a law-trained reviewer checks 10 recitation drills, 10 Quick Checks
    and 10 problem drills. There must be zero fabricated citations, and any material legal error blocks release.
23. All automated tests pass (`npm test`).

**Default class schedule (Philippine time)**

24. Given a new Year 1–2 or Year 3–4 user, when they open Settings for the first time, then the class schedule
    already shows Monday–Friday 6:00–9:00 PM and Saturday–Sunday 8:00 AM–6:00 PM, and they can edit or clear it.
25. Given a Year 1–2 user with the default schedule, then they are paused on Wednesday at 7:30 PM and on Saturday
    at 10:00 AM (Manila time), and not paused on Wednesday at 9:00 PM or on Saturday at 6:00 PM.
26. Given a Year 3–4 user with the default schedule, when they open the app on Sunday at 2:00 PM (Manila time),
    then In-class Quick Check is the first option on the home screen.
27. Given a bar reviewee, then no class schedule is shown or applied.

**Year-based topics and demo content (added 11 Nov 2026)**

31. Given a Year 3 student, then the topic list shows General Principles, Income Tax, Value-Added Tax, Estate and Donor's
    Taxes, Local Taxation, Real Property Taxation, Tax Remedies and Court of Tax Appeals topics; Year 1 and Year 2 are not
    offered, and no topic covers Customs.
32. Given a Year 4 student or any bar reviewee, then every Taxation Law topic is listed.
33. Given a topic file marked `status: demo` without reviewer sign-off, then the topic is listed with
    "(demo)" and the demo banner appears on the home screen and on every drill screen for that topic.
34. Given a topic file with neither reviewer sign-off nor `status: demo`, then it does not appear (criterion 8 still holds).
35. Given any topic file in `sources/`, then it contains a citation, an https link, the source text,
    at least two key points, a recitation fact pattern and model answer, a problem, and all four ALAC parts.
36. Given the topic list, then subject areas appear in the teaching order set in `lib/subject.ts`.

**5-point bar-coach rubric (added 11 Nov 2026)**

37. Given the labels conclusion correct, rule correct, application correct, then the Practice score is 5/5; for every
    other row of the rubric table in Section 3.2 the score matches that row (one automated test per row).
38. Given an answer with a correct rule and application but no conclusion, then the score is 0/5 with the message that a
    conclusion is indispensable.
39. Given an answer that argues a different legal issue from the one asked, then the score is 0/5 and coaching starts
    with the Answer.
40. Given the AI's reply also contains a number, then the score is still computed from the labels only.
41. Given a retry that fixes the coached part, then the score is recomputed from the updated labels (e.g. 2/5 → 3/5).

**Landing page, subject scope and original problems (added 12 Nov 2026)**

42. Given a first visit, then page 1 shows one Register button and no list of years or groups. Register asks "Which
    describes you?" with only the categories this app serves, then the exact year (students) or "Have you taken the Bar
    exam before?" (bar reviewees); after the usage notice, the category's page opens (`/year-1-2`, `/year-3-4` or `/bar`).
43. Given a returning user who has seen the notice, then page 1 shows one "Continue as …" button to their category's page,
    and "Change my details" (Settings or the drills page) restarts registration at the category step.
44. Given a year with no Taxation Law topics in the year plan, then that year is not offered.
45. Given any topic file, then its subject is one of this app's subject areas (no topics from another bar subject) and its
    `year-1`/`year-2`/`year-3` tags match the year plan in `lib/subject.ts` exactly.
46. Given any problem drill, then the problem is an original bar-style problem (or, for older topics, a past bar question
    shown with its year and number), and the model answer was written for this app.
47. Given any topic, then it falls within the 2027 Bar syllabus for Commercial and Taxation Laws, Taxation Law part (VII).

**Year 1–2 objective and multiple-choice quiz (added 12 Nov 2026)**

48. Given a Year 1–2 user outside class hours, then the drills page offers "Objective & multiple-choice quiz" first;
    given a Year 3–4 user or any bar reviewee, then it is never offered and `/api/quiz` refuses them.
49. Given a quiz question, then the browser receives the question and options only: no answer, hint or explanation.
50. Given a wrong try, then the next hint from the topic file is shown, in order, and the answer is not revealed.
51. Given more wrong tries than hints, then a multiple-choice question removes one wrong option per try (never the
    correct one, and at least two options stay) and an objective question shows one more letter of the answer per try.
52. Given a correct try, then "Correct" and the explanation are shown; objective answers ignore case, punctuation and spacing.
53. Given any Year 1–2 topic file, then its quiz has at least two multiple-choice and two objective questions, each with a
    hint and an explanation. The quiz makes no AI call and pauses during class hours like every Year 1–2 feature.

**Topic order (added 12 Nov 2026)**

54. Given any topic file, then it has a `syllabusRef` (its place in the 2027 Bar syllabus outline, e.g. `VIII.A.7`), and the
    topic list is sorted in syllabus order.
55. Given a Year 1–2 user, then the drills page selects the first topic in syllabus order they haven't finished and says
    "Next up: …"; a topic is finished once its quiz and at least one problem drill are done, and is marked ✓.
56. Given a Year 3–4 user or a bar reviewee, then the drills page starts on a random topic and offers a "Random topic"
    button that never picks the same topic twice in a row (when there is a choice).

**Registration and confidential repeater status (added 12 Nov 2026)**

57. Given a bar reviewee who answers No to "Have you taken the Bar exam before?", then they are saved as `bar-first-time`;
    Yes saves `bar-repeater`. The question says the answer is private and stays on the device.
58. Given any bar reviewee, then no screen (landing, drills page, Settings, diagnostic) shows "repeater" or "first-time";
    every screen says "Bar reviewee", and the diagnostic wording and its Skip option are the same for both.
59. Given any bar reviewee, then requests from the browser carry `group=bar`, never the repeater status.
60. Given a user on another category's page (e.g. a Year 2 student opening `/bar`), then they are sent to their own page.

**Step by step for Year 1–2; required diagnostic for repeaters (added 12 Nov 2026)**

61. Given a Year 1–2 student on a topic, then the drills appear as Step 1 quiz, Step 2 recitation, Step 3 problem drill;
    the recitation stays locked until that topic's quiz is done, and the problem drill until its recitation is done.
    Year 3–4 and bar reviewees have no locks and can start a bar-style problem immediately.
62. Given a bar repeater who has not finished the diagnostic, then the bar page shows only the diagnostic (no Skip, no
    topic list) until all diagnostic problems are answered; a first-time taker may skip it. The wording is the same for both.

## 6. Planned improvements (not built yet)
Requested after the first test run (10 Nov 2026). Build these in a later round; they are not part of v1's
release checks until moved into Section 5.

### UI-1: Questions look different from feedback
In every drill and Quick Check, a reader must tell at a glance what is the tutor's **question** and what is
**feedback** on their answer.
- **Tutor question:** its own card with a distinct background colour (e.g. soft blue), a slightly larger,
  bolder font, and a small label "Question".
- **Feedback:** a separate card with a different background (e.g. warm grey or cream), regular-weight text,
  and a label showing the verdict ("Correct", "Partly correct", "Not yet"), each verdict with its own
  accent colour.
- **Source citation:** shown under the feedback in small text with the link, never mixed into the question.
- **Readability:** text and background colours meet WCAG AA contrast (4.5:1 for body text); readable at
  360 pixels wide; colour is never the only signal (labels stay).

### UI-2: Key words highlighted
- Legal key terms (e.g. "juridical necessity", "prestation") are highlighted wherever they appear in the
  question, feedback, model answer or source text.
- The terms come **only** from a reviewer-approved `keyTerms` list in each topic's source file. The AI
  doesn't choose which words to highlight, so highlighting can't introduce unreviewed legal content.
- Highlight style: bold with a light background tint, readable on both the question and feedback cards.
- Article numbers and case citations from the source file (e.g. "Article 1156") are also highlighted.

### Acceptance criteria to add when built
28. Given any drill turn, then the question and the feedback appear in visually different cards
    (different background colour, font weight and label), with WCAG AA contrast.
29. Given a topic whose `keyTerms` lists "prestation", when that word appears in a question or feedback,
    then it is highlighted; words not in `keyTerms` are not.
30. Given a 360-pixel-wide screen, then the question and feedback cards and highlights remain readable
    without sideways scrolling.

## 7. Revision log
| Date | Change | Why (review finding) |
|---|---|---|
| 6 Nov 2026 | First spec (Sections 1–5) from the validation research | Exercise 1 |
| 6 Nov 2026 | Spec reviewed by Claude ("what's ambiguous, missing, or risky?"); agreed fixes merged. ALAC rubric confirmed by a bar coach | Exercise 1, Phase 4 review |
| 10 Nov 2026 | Added the default Philippine class schedule (criteria 24–27) | The class-time pause should work before a student enters their own schedule |
| 10 Nov 2026 | Added planned UI-1 and UI-2 (Section 6) | First test run: questions and feedback looked alike |
| 11 Nov 2026 | Content narrowed to **Civil Law by year** (Y1 Persons and Family, Obligations; Y2 Sales; Y3 Succession; Y4 and bar: all); added `studentYear` | Founder review against the law-school curriculum and the bar Q&A compilation |
| 11 Nov 2026 | Added **demo topics** with a visible banner (criteria 33–34) | Review of the live app: the topic list was empty until lawyer sign-off, so the core feature couldn't be shown |
| 11 Nov 2026 | Added criteria 35–36 (topic-file completeness, subject order) | Local testing found topics in alphabetical, not teaching, order |
| 11 Nov 2026 | Problem-drill scoring changed from 0–8 (four ALAC parts × 0–2) to the **5-point bar-coach rubric** organised by ALAC; the AI labels parts and code computes the score; off-topic answers score 0 (criteria 16–17 revised, 37–41 added) | Owner review against a bar-review center's AI rubric and sample feedback reports: one number students recognise, consistent scoring, and a check that the answer addresses the question asked |
| 12 Nov 2026 | Created **Law AI Tutor - Taxation** from the Civil app's code: Taxation Law only, scope limited to the 2027 Bar syllabus (Commercial and Taxation Laws, Part VII); Customs left out (not in the syllabus); Year 3 all areas, Year 4 and bar all; Year 1 and Year 2 not offered (so no objective quiz); seven demo topics with original bar-style problems; random topics for Year 3–4 and bar (criteria 31, 36 revised; 42–56 added) | Owner request to split the tutor into three subject apps |
