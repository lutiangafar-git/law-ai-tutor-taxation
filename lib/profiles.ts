import type { StudentYear, UserGroup } from "./types";
import { SUBJECT, areasForYear, listAreas, offeredYears } from "./subject";

/**
 * Registration (spec §1 "Landing page", criteria 42–44 and 57–62).
 * Page 1 shows one "Register" button. The user then picks a category
 * (Year 1–2, Year 3–4 or Bar reviewee), then either their exact year or, for bar
 * reviewees, whether they have taken the Bar before (No → first-time, Yes → repeater).
 *
 * Repeater status is CONFIDENTIAL: it is stored only on the user's device, decides
 * only the diagnostic, and is never shown on screen or put in a web address.
 * Every screen says "Bar reviewee" for both bar groups.
 */
export interface ProfileOption {
  key: string;
  group: UserGroup;
  year: StudentYear | null;
  /** On-screen name. Never reveals repeater status. */
  label: string;
  blurb: string;
}

export const BAR_LABEL = "Bar reviewee";

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

const BAR_BLURB = `All ${SUBJECT.subjectName} topics in the 2027 Bar syllabus, anytime.`;

export const PROFILE_OPTIONS: ProfileOption[] = [
  ...offeredYears().map(studentOption),
  { key: "bar-first-time", group: "bar-first-time", year: null, label: BAR_LABEL, blurb: BAR_BLURB },
  { key: "bar-repeater", group: "bar-repeater", year: null, label: BAR_LABEL, blurb: BAR_BLURB },
];

/** Finds the option matching a saved group and year. */
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

/** What the screen calls this user. Both bar groups are just "Bar reviewee". */
export function displayLabel(group: UserGroup | null, year: StudentYear | null): string {
  if (!group) return "";
  if (group === "bar-first-time" || group === "bar-repeater") return BAR_LABEL;
  return findProfile(group, year)?.label ?? "";
}

// ------------------------------------------------------------------ categories

export type Category = "year-1-2" | "year-3-4" | "bar";

export interface CategoryOption {
  key: Category;
  label: string;
  blurb: string;
  /** Student years offered in this category for this subject (empty for bar). */
  years: StudentYear[];
}

/** The categories this subject's app serves. A student category appears only if it has a year with topics. */
export function categoryOptions(): CategoryOption[] {
  const offered = offeredYears();
  const early = offered.filter((y) => y <= 2);
  const late = offered.filter((y) => y >= 3);
  const out: CategoryOption[] = [];
  if (early.length) {
    out.push({
      key: "year-1-2",
      label: "Law student, Year 1–2",
      blurb: "Build the basics after class, step by step through the syllabus.",
      years: early,
    });
  }
  if (late.length) {
    out.push({
      key: "year-3-4",
      label: "Law student, Year 3–4",
      blurb: "Quick Check in class; random drills to test your general knowledge.",
      years: late,
    });
  }
  out.push({
    key: "bar",
    label: BAR_LABEL,
    blurb: "Bar-style essay drills on random topics, anytime.",
    years: [],
  });
  return out;
}

/** Years of the pair that this subject does NOT offer, for a short note (e.g. "Year 1 has no Commercial Law"). */
export function missingYears(category: Category): StudentYear[] {
  if (category === "bar") return [];
  const pair: StudentYear[] = category === "year-1-2" ? [1, 2] : [3, 4];
  const offered = offeredYears();
  return pair.filter((y) => !offered.includes(y));
}

export function categoryOf(group: UserGroup | null): Category | null {
  if (!group) return null;
  if (group === "year-1-2" || group === "year-3-4") return group;
  return "bar";
}

/** Each category has its own drills page. */
export function categoryPath(group: UserGroup | null): string {
  const c = categoryOf(group);
  return c ? `/${c}` : "/";
}

/** Bar reviewees: "Have you taken the Bar exam before?" No → first-time; Yes → repeater. */
export function barGroupFromHistory(takenBefore: boolean): UserGroup {
  return takenBefore ? "bar-repeater" : "bar-first-time";
}

/**
 * Group value for web addresses (`?group=`). Both bar groups become "bar",
 * so repeater status never appears in a URL, browser history or request log.
 */
export function groupForUrl(group: UserGroup | null): string {
  if (!group) return "";
  return group === "bar-first-time" || group === "bar-repeater" ? "bar" : group;
}

/** Query-string suffix for /api/topics, e.g. "&year=2". Empty for bar reviewees. */
export function yearQuery(year: StudentYear | null | undefined): string {
  return year ? `&year=${year}` : "";
}
