import type { StudentYear, UserGroup } from "./types";
import { SUBJECT, areasForYear, listAreas, offeredYears } from "./subject";

/**
 * The choices shown on the landing page ("Who are you practicing as?") and in Settings.
 * Each student year maps to the usage-rule group in /lib/access.ts
 * (Year 1–2 or Year 3–4), so usage rules stay in one place.
 * Years with no topics for this subject (see /lib/subject.ts) are not offered.
 */
export interface ProfileOption {
  key: string;
  group: UserGroup;
  year: StudentYear | null;
  label: string;
  blurb: string;
}

function studentOption(year: StudentYear): ProfileOption {
  const early = year <= 2;
  const rule = early
    ? "After class only."
    : "Quick Check in class; drills outside class.";
  const topics =
    year === 4 ? `All ${SUBJECT.subjectName} topics.` : `${listAreas(areasForYear(year))}.`;
  return {
    key: `year-${year}`,
    group: early ? "year-1-2" : "year-3-4",
    year,
    label: `Year ${year} student`,
    blurb: `${topics} ${rule}`,
  };
}

export const PROFILE_OPTIONS: ProfileOption[] = [
  ...offeredYears().map(studentOption),
  {
    key: "bar-first-time",
    group: "bar-first-time",
    year: null,
    label: "Bar reviewee (first-time)",
    blurb: `All ${SUBJECT.subjectName} topics, anytime. Optional diagnostic.`,
  },
  {
    key: "bar-repeater",
    group: "bar-repeater",
    year: null,
    label: "Bar reviewee (repeater)",
    blurb: `All ${SUBJECT.subjectName} topics, anytime. A short diagnostic finds weak spots first.`,
  },
];

/** Finds the option matching a saved group and year (used to tick the right radio button). */
export function findProfileKey(
  group: UserGroup | null,
  year: StudentYear | null,
): string | null {
  if (!group) return null;
  const exact = PROFILE_OPTIONS.find((p) => p.group === group && p.year === year);
  if (exact) return exact.key;
  return PROFILE_OPTIONS.find((p) => p.group === group)?.key ?? null;
}

/** The option for a saved profile, e.g. to show "Continue as Year 2 student". */
export function findProfile(
  group: UserGroup | null,
  year: StudentYear | null,
): ProfileOption | null {
  const key = findProfileKey(group, year);
  return PROFILE_OPTIONS.find((p) => p.key === key) ?? null;
}

/** Query-string suffix for /api/topics, e.g. "&year=2". Empty for bar reviewees. */
export function yearQuery(year: StudentYear | null | undefined): string {
  return year ? `&year=${year}` : "";
}
