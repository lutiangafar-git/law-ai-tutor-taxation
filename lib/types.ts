export type UserGroup =
  | "year-1-2"
  | "year-3-4"
  | "bar-first-time"
  | "bar-repeater";

export type Feature =
  | "objective-quiz"
  | "recitation-drill"
  | "in-class-quick-check"
  | "problem-drill";

/** Law school year (1–4). Usage rules still group years in pairs (see /lib/access.ts). */
export type StudentYear = 1 | 2 | 3 | 4;

/** Who a topic file is for. Single years are preferred; pair tags are kept for older files. */
export type YearLevelTag =
  | "year-1"
  | "year-2"
  | "year-3"
  | "year-4"
  | "year-1-2"
  | "year-3-4"
  | "bar";

export type Verdict = "correct" | "partly correct" | "not yet";

export type AlacElement =
  | "Answer"
  | "Legal basis"
  | "Application"
  | "Conclusion";

export interface ClassBlock {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  label?: string;
}

export interface ClassSchedule {
  blocks: ClassBlock[];
}

export interface SourceMeta {
  topicId: string;
  title: string;
  subject: string;
  yearLevels: YearLevelTag[];
  syllabusWeek?: number;
  /** Place in the 2027 Bar syllabus outline, e.g. "VIII.A.7" (see /lib/topicOrder.ts). */
  syllabusRef: string;
  /** Bar syllabus year this topic was last checked against (must equal BAR_EXAM.year). */
  syllabusYear: number;
  citation: string;
  link: string;
  reviewedBy: string;
  lastReviewed: string;
  /** True for demo topics that a lawyer has not yet signed off (`status: demo`). */
  isDemo: boolean;
}

export interface SourceTopic extends SourceMeta {
  sourceText: string;
  /** Year 1–2 objective and multiple-choice items (see /lib/quiz.ts). */
  quiz: import("./quiz").QuizItem[];
  keyPoints: string[];
  recitationScenario: string;
  recitationModelAnswer: string;
  problem: string;
  modelAnswer: {
    answer: string;
    legalBasis: string;
    application: string;
    conclusion: string;
  };
  rawMarkdown: string;
}

export interface TutorSourceRef {
  title: string;
  citation: string;
  link: string;
  reviewedBy: string;
  lastReviewed: string;
}

export interface AlacScores {
  Answer: number;
  "Legal basis": number;
  Application: number;
  Conclusion: number;
}

/** Per-part label from the 5-point rubric (see /lib/rubric.ts). */
export type AlacElementStatus = "correct" | "incorrect" | "missing";

export interface RubricScore {
  points: number;
  band: string;
  explanation: string;
}

export interface TutorTurnResponse {
  verdict: Verdict;
  feedback: string;
  nextQuestion?: string;
  rubric?: Record<string, number> | AlacScores;
  oneThingToFix?: string;
  sources?: TutorSourceRef[];
  weakElement?: AlacElement;
  modelAnswer?: string;
  declined?: boolean;
  /** Problem drills: 0–5 Practice score computed in code from the ALAC labels. */
  rubricScore?: RubricScore;
  alacStatus?: Record<AlacElement, AlacElementStatus>;
  /** One-line reason per ALAC part. */
  elementNotes?: Partial<Record<AlacElement, string>>;
  /** False when the answer addresses a different legal issue from the one asked. */
  responsive?: boolean;
  strengths?: string[];
  gaps?: string[];
}

export interface DrillProgress {
  feature: Feature;
  topicId: string;
  step: number;
  attemptCount: number;
  answers: string[];
  scores: number[];
  alacScores?: AlacScores;
  alacStatus?: Record<AlacElement, AlacElementStatus>;
  rubricScore?: RubricScore;
  responsive?: boolean;
  weakElement?: AlacElement;
  phase?:
    | "answering"
    | "scored"
    | "coaching"
    | "retry"
    | "complete"
    | "quick-check"
    | "quick-check-done";
  exchangeCount?: number;
  updatedAt: string;
}

export interface ProblemScoreRecord {
  topicId: string;
  scores: AlacScores;
  /** 0–5 Practice score (absent on records saved before the 5-point rubric). */
  points?: number;
  finishedAt: string;
  isDiagnostic?: boolean;
}

export interface StoredUserState {
  userGroup: UserGroup | null;
  /** Exact law school year for students; null for bar reviewees. */
  studentYear: StudentYear | null;
  classSchedule: ClassSchedule;
  usageNoticeSeen: boolean;
  diagnosticOffered: boolean;
  diagnosticCompleted: boolean;
  diagnosticTopicIds: string[];
  activeDrill: DrillProgress | null;
  problemScores: ProblemScoreRecord[];
  /** Finished Year 1–2 objective quizzes. */
  quizResults: { topicId: string; firstTry: number; total: number; finishedAt: string }[];
  recitationScores: {
    topicId: string;
    stepScores: number[];
    finishedAt: string;
  }[];
  rateLimit: { windowStart: number; count: number };
}
