import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { SourceTopic, StudentYear, UserGroup, YearLevelTag } from "./types";
import { SUBJECT } from "./subject";
import { QUIZ_SECTION_HEADING, parseQuizSection } from "./quiz";
import { compareSyllabusRef } from "./topicOrder";

/** Shown wherever a reviewer name would appear, for topics marked `status: demo`. */
export const DEMO_REVIEW_LABEL = "Demo content: pending lawyer review";

/** Subject areas in the order law schools teach them (from /lib/subject.ts); unknown ones go last. */
export const SUBJECT_ORDER = SUBJECT.areas;

function subjectRank(subject: string): number {
  const i = SUBJECT_ORDER.indexOf(subject);
  return i === -1 ? SUBJECT_ORDER.length : i;
}

function sourcesDir(): string {
  return path.join(process.cwd(), "sources");
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(
    `#\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n#\\s|$)`,
    "i",
  );
  const match = body.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function fieldAfterLabel(section: string, label: string): string {
  const re = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\n(?:Scenario|Model answer|Problem|Answer|Legal basis|Application|Conclusion):|$)`,
    "i",
  );
  const match = section.match(re);
  return match?.[1]?.trim() ?? "";
}

function parseModelAnswerBlock(section: string): SourceTopic["modelAnswer"] {
  const pick = (label: string) => {
    const re = new RegExp(
      `-\\s*${label}:\\s*([\\s\\S]*?)(?=\\n-\\s*(?:Answer|Legal basis|Application|Conclusion):|$)`,
      "i",
    );
    return section.match(re)?.[1]?.trim() ?? "";
  };
  return {
    answer: pick("Answer"),
    legalBasis: pick("Legal basis"),
    application: pick("Application"),
    conclusion: pick("Conclusion"),
  };
}

function isReviewed(data: Record<string, unknown>): boolean {
  const reviewedBy = String(data.reviewedBy ?? "").trim();
  const lastReviewed = String(data.lastReviewed ?? "").trim();
  return Boolean(reviewedBy && lastReviewed);
}

/**
 * Demo topics (`status: demo`) are shown with a "pending lawyer review" banner.
 * A topic that is neither reviewed nor demo stays hidden (spec criterion 8).
 */
function isDemo(data: Record<string, unknown>): boolean {
  return String(data.status ?? "").trim().toLowerCase() === "demo";
}

function parseTopicFile(filePath: string): SourceTopic | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const reviewed = isReviewed(data);
  const demo = !reviewed && isDemo(data);
  if (!reviewed && !demo) return null;

  const yearLevels = asStringArray(data.yearLevels) as YearLevelTag[];
  const keyPointsSection =
    extractSection(content, "Key points for the tutor (reviewer-approved)") ||
    extractSection(content, "Key points for the tutor");
  const recitationSection = extractSection(
    content,
    "Recitation drill: application fact pattern",
  );
  const problemSection = extractSection(
    content,
    "Problem drill: exam or bar-style problem",
  );

  return {
    topicId: String(data.topicId ?? path.basename(filePath, ".md")),
    title: String(data.title ?? ""),
    subject: String(data.subject ?? ""),
    yearLevels,
    syllabusRef: String(data.syllabusRef ?? "").trim(),
    syllabusYear: Number(data.syllabusYear ?? 0),
    syllabusWeek:
      data.syllabusWeek !== undefined ? Number(data.syllabusWeek) : undefined,
    citation: String(data.citation ?? ""),
    link: String(data.link ?? ""),
    reviewedBy: demo ? DEMO_REVIEW_LABEL : String(data.reviewedBy ?? ""),
    lastReviewed: demo ? "" : String(data.lastReviewed ?? ""),
    isDemo: demo,
    sourceText: extractSection(content, "Source text"),
    quiz: parseQuizSection(extractSection(content, QUIZ_SECTION_HEADING)),
    keyPoints: extractBullets(keyPointsSection),
    recitationScenario: fieldAfterLabel(recitationSection, "Scenario"),
    recitationModelAnswer: fieldAfterLabel(recitationSection, "Model answer"),
    problem: fieldAfterLabel(problemSection, "Problem"),
    modelAnswer: parseModelAnswerBlock(problemSection),
    rawMarkdown: content,
  };
}

export function loadAllReviewedTopics(): SourceTopic[] {
  const dir = sourcesDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => parseTopicFile(path.join(dir, name)))
    .filter((topic): topic is SourceTopic => topic !== null)
    // Order of the 2027 Bar syllabus outline; then subject area, then title.
    .sort(
      (a, b) =>
        compareSyllabusRef(a.syllabusRef, b.syllabusRef) ||
        subjectRank(a.subject) - subjectRank(b.subject) ||
        a.title.localeCompare(b.title),
    );
}

/**
 * Which topic tags a user sees.
 * - A student with a known year sees that year's topics (plus old pair-tagged files).
 * - A student without a saved year sees both years of their pair.
 * - Bar reviewees see topics tagged `bar`.
 */
export function groupToYearTags(
  group: UserGroup,
  year?: StudentYear | null,
): YearLevelTag[] {
  if (group === "year-1-2") {
    if (year === 1) return ["year-1", "year-1-2"];
    if (year === 2) return ["year-2", "year-1-2"];
    return ["year-1", "year-2", "year-1-2"];
  }
  if (group === "year-3-4") {
    if (year === 3) return ["year-3", "year-3-4"];
    if (year === 4) return ["year-4", "year-3-4"];
    return ["year-3", "year-4", "year-3-4"];
  }
  return ["bar"];
}

export function getTopicsForGroup(
  group: UserGroup,
  year?: StudentYear | null,
): SourceTopic[] {
  const tags = groupToYearTags(group, year);
  return loadAllReviewedTopics().filter((topic) =>
    topic.yearLevels.some((y) => tags.includes(y)),
  );
}

export function getTopicById(
  topicId: string,
  group?: UserGroup,
  year?: StudentYear | null,
): SourceTopic | null {
  const topics = group ? getTopicsForGroup(group, year) : loadAllReviewedTopics();
  return topics.find((t) => t.topicId === topicId) ?? null;
}

/** Parses a `year` query value; anything other than 1–4 means "not given". */
export function parseStudentYear(value: unknown): StudentYear | null {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/** Safe payload for the client: no model answers until the drill reveals them. */
export function toClientTopicSummary(topic: SourceTopic) {
  return {
    topicId: topic.topicId,
    title: topic.title,
    subject: topic.subject,
    citation: topic.citation,
    link: topic.link,
    reviewedBy: topic.reviewedBy,
    lastReviewed: topic.lastReviewed,
    yearLevels: topic.yearLevels,
    isDemo: topic.isDemo,
    syllabusRef: topic.syllabusRef,
  };
}
