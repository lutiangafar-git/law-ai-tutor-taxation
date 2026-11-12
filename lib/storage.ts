import { recordReview, scheduleMissed } from "./adaptive";
import {
  createDefaultStudentClassSchedule,
  isStudentGroup,
} from "./access";
import type {
  AlacElement,
  AlacScores,
  ClassSchedule,
  DrillProgress,
  ProblemScoreRecord,
  StoredUserState,
  StudentYear,
  UserGroup,
} from "./types";

const STORAGE_KEY = "law-tutor-v1";

export const DEFAULT_STATE: StoredUserState = {
  userGroup: null,
  studentYear: null,
  classSchedule: { blocks: [] },
  usageNoticeSeen: false,
  diagnosticOffered: false,
  diagnosticCompleted: false,
  diagnosticTopicIds: [],
  activeDrill: null,
  problemScores: [],
  quizResults: [],
  recitationScores: [],
  rateLimit: { windowStart: 0, count: 0 },
  quizReview: [],
};

function canUseBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadState(): StoredUserState {
  if (!canUseBrowser()) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<StoredUserState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      classSchedule: parsed.classSchedule ?? { blocks: [] },
      problemScores: parsed.problemScores ?? [],
      recitationScores: parsed.recitationScores ?? [],
      quizResults: parsed.quizResults ?? [],
      diagnosticTopicIds: parsed.diagnosticTopicIds ?? [],
      rateLimit: parsed.rateLimit ?? { windowStart: 0, count: 0 },
      quizReview: Array.isArray(parsed.quizReview) ? parsed.quizReview : [],
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: StoredUserState): void {
  if (!canUseBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function updateState(
  patch: Partial<StoredUserState> | ((prev: StoredUserState) => StoredUserState),
): StoredUserState {
  const prev = loadState();
  const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
  saveState(next);
  return next;
}

export function setUserGroup(
  group: UserGroup,
  year: StudentYear | null = null,
): StoredUserState {
  const prev = loadState();
  const becomingStudent = isStudentGroup(group);
  const wasStudent = isStudentGroup(prev.userGroup);

  let classSchedule = prev.classSchedule;
  if (!becomingStudent) {
    // Bar reviewees: no schedule shown or applied.
    classSchedule = { blocks: [] };
  } else if (!wasStudent) {
    // New Year 1–2 / Year 3–4 users get the typical Philippine law-school schedule.
    classSchedule = createDefaultStudentClassSchedule();
  }

  return updateState({
    userGroup: group,
    // Bar reviewees have no school year.
    studentYear: becomingStudent ? year : null,
    usageNoticeSeen: false,
    diagnosticOffered:
      group === "bar-repeater" ? false : prev.diagnosticOffered,
    classSchedule,
  });
}

export function markUsageNoticeSeen(): StoredUserState {
  return updateState({ usageNoticeSeen: true });
}

export function setClassSchedule(schedule: ClassSchedule): StoredUserState {
  return updateState({ classSchedule: schedule });
}

/** Clears every class block (students may clear the pre-filled default). */
export function clearClassSchedule(): StoredUserState {
  return setClassSchedule({ blocks: [] });
}

export function saveActiveDrill(drill: DrillProgress | null): StoredUserState {
  return updateState({ activeDrill: drill });
}

export function clearActiveDrill(): StoredUserState {
  return updateState({ activeDrill: null });
}

export function addQuizResult(record: StoredUserState["quizResults"][number]): StoredUserState {
  const state = loadState();
  return updateState({ quizResults: [...state.quizResults, record].slice(-200) });
}

/** Puts every question missed in a quiz on the 1-day review wait. */
export function scheduleMissedQuestions(topicId: string, itemIndexes: number[], now = new Date()): StoredUserState {
  return updateState((prev) => ({
    ...prev,
    quizReview: itemIndexes.reduce((q, i) => scheduleMissed(q, topicId, i, now), prev.quizReview).slice(-300),
  }));
}

/** Records a spaced-review answer: right on the first try moves it on; wrong starts it over. */
export function recordReviewAnswer(topicId: string, itemIndex: number, rightFirstTry: boolean, now = new Date()): StoredUserState {
  return updateState((prev) => ({
    ...prev,
    quizReview: recordReview(prev.quizReview, topicId, itemIndex, rightFirstTry, now),
  }));
}

export function addProblemScore(record: ProblemScoreRecord): StoredUserState {
  return updateState((prev) => ({
    ...prev,
    problemScores: [...prev.problemScores, record].slice(-50),
  }));
}

export function addRecitationScore(
  topicId: string,
  stepScores: number[],
): StoredUserState {
  return updateState((prev) => ({
    ...prev,
    recitationScores: [
      ...prev.recitationScores,
      { topicId, stepScores, finishedAt: new Date().toISOString() },
    ].slice(-50),
  }));
}

export function markDiagnosticOffered(topicIds: string[] = []): StoredUserState {
  return updateState({
    diagnosticOffered: true,
    diagnosticTopicIds: topicIds,
  });
}

export function markDiagnosticCompleted(): StoredUserState {
  return updateState({ diagnosticCompleted: true });
}

/** Lowest-scoring ALAC element across the last N finished problem drills. */
export function getWeakSpots(
  scores: ProblemScoreRecord[],
  lastN = 10,
): { element: AlacElement; average: number }[] {
  const recent = scores.slice(-lastN);
  if (recent.length === 0) return [];

  const elements: AlacElement[] = [
    "Answer",
    "Legal basis",
    "Application",
    "Conclusion",
  ];

  return elements
    .map((element) => {
      const total = recent.reduce((sum, r) => sum + (r.scores[element] ?? 0), 0);
      return { element, average: total / recent.length };
    })
    .sort((a, b) => a.average - b.average);
}

export function lowestAlacElement(scores: AlacScores): AlacElement {
  const elements: AlacElement[] = [
    "Answer",
    "Legal basis",
    "Application",
    "Conclusion",
  ];
  return elements.reduce((lowest, el) =>
    scores[el] < scores[lowest] ? el : lowest,
  );
}

const RATE_LIMIT_PER_HOUR = 30;

/** Returns true if another tutor message is allowed; also increments the counter. */
export function consumeRateLimit(now = Date.now()): {
  allowed: boolean;
  remaining: number;
} {
  const state = loadState();
  const hourMs = 60 * 60 * 1000;
  let { windowStart, count } = state.rateLimit;

  if (!windowStart || now - windowStart >= hourMs) {
    windowStart = now;
    count = 0;
  }

  if (count >= RATE_LIMIT_PER_HOUR) {
    saveState({ ...state, rateLimit: { windowStart, count } });
    return { allowed: false, remaining: 0 };
  }

  count += 1;
  saveState({ ...state, rateLimit: { windowStart, count } });
  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count };
}
