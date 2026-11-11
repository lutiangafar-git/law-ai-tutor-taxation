/**
 * The Bar Examination this app is scoped to. CHANGE THIS ONCE A YEAR when the Supreme Court
 * issues the next Bar Bulletin with its syllabus.
 *
 * Every topic file in /sources carries `syllabusYear`. After you change `year` here, the tests
 * fail until each topic has been checked against the new syllabus and its `syllabusYear` (and,
 * if needed, `syllabusRef`) updated, so no drill question can drift outside the current scope.
 */
export const BAR_EXAM = {
  year: 2027,
  bulletin: "Bar Bulletin No. 1-2027",
  bulletinDate: "16 September 2026",
  /** Laws, rules and jurisprudence examinable only as of this date. */
  cutoff: "June 30, 2026",
  syllabusUrl: "https://sc.judiciary.gov.ph/bar-2027",
} as const;

export const SYLLABUS_LABEL = `${BAR_EXAM.year} Bar syllabus`;
