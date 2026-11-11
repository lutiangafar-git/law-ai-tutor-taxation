import type { ClassBlock, ClassSchedule, Feature, UserGroup } from "./types";

/** Class schedules are Philippine wall time, including on Vercel (UTC) servers. */
export const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Typical Philippine law-school schedule (Asia/Manila).
 * Mon–Fri 6:00–9:00 PM; Sat–Sun 8:00 AM–6:00 PM.
 */
export function createDefaultStudentClassSchedule(): ClassSchedule {
  const weekdayEvening: Omit<ClassBlock, "dayOfWeek" | "label"> = {
    startMinutes: 18 * 60,
    endMinutes: 21 * 60,
  };
  const weekendDay: Omit<ClassBlock, "dayOfWeek" | "label"> = {
    startMinutes: 8 * 60,
    endMinutes: 18 * 60,
  };

  const blocks: ClassBlock[] = [
    ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
      dayOfWeek,
      ...weekdayEvening,
      label: `${WEEKDAY_LABELS[dayOfWeek]} 6:00 PM–9:00 PM`,
    })),
    ...[6, 0].map((dayOfWeek) => ({
      dayOfWeek,
      ...weekendDay,
      label: `${WEEKDAY_LABELS[dayOfWeek]} 8:00 AM–6:00 PM`,
    })),
  ];

  return { blocks };
}

export function isStudentGroup(group: UserGroup | null | undefined): boolean {
  return group === "year-1-2" || group === "year-3-4";
}

export function isBarGroup(group: UserGroup | null | undefined): boolean {
  return group === "bar-first-time" || group === "bar-repeater";
}

/** Bar reviewees never have a schedule applied, even if one was left in storage. */
export function getEffectiveClassSchedule(
  group: UserGroup,
  schedule: ClassSchedule | null | undefined,
): ClassSchedule {
  if (isBarGroup(group)) return { blocks: [] };
  return schedule ?? { blocks: [] };
}

export const USAGE_NOTICES: Record<UserGroup, string> = {
  "year-1-2":
    "Use this after class to prepare for your next recitations and exams. It isn't available during class, and it isn't for exams or graded work.",
  "year-3-4":
    "During class, use Quick Check to test your reasoning for recitation. Outside class, use drills to prepare for exams. Follow your professor's rules. Never use it during exams or quizzes.",
  "bar-first-time":
    "Practice anytime. Not for use during proctored mock exams (unless your review center allows it) or the bar exam itself.",
  "bar-repeater":
    "Practice anytime. Not for use during proctored mock exams (unless your review center allows it) or the bar exam itself.",
};

export const CLASS_TIME_PAUSE_MESSAGE =
  "It's class time. Come back after class to review.";

export const GRADED_WORK_DECLINE_MESSAGE =
  "I can't help write case digests, papers, memoranda, or other graded work. Follow your school's or review center's AI policy, and use this tutor only for practice.";

const WEEKDAY_TO_DAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Day-of-week and minutes-since-midnight for `now` in Asia/Manila.
 * Uses the instant's Philippine clock, not the server's local timezone.
 */
export function getManilaClockParts(now: Date = new Date()): {
  dayOfWeek: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILIPPINE_TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  // Some engines report midnight as 24 under h23.
  if (hour === 24) hour = 0;

  return {
    dayOfWeek: WEEKDAY_TO_DAY[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

/** True when `now` (interpreted in Asia/Manila) falls inside any saved class block. */
export function isDuringClassHours(
  schedule: ClassSchedule | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!schedule?.blocks?.length) return false;
  const { dayOfWeek, minutes } = getManilaClockParts(now);

  return schedule.blocks.some((block) => {
    if (block.dayOfWeek !== dayOfWeek) return false;
    return minutes >= block.startMinutes && minutes < block.endMinutes;
  });
}

export function isPausedForClass(
  group: UserGroup,
  schedule: ClassSchedule | null | undefined,
  now: Date = new Date(),
): boolean {
  if (group !== "year-1-2") return false;
  return isDuringClassHours(getEffectiveClassSchedule(group, schedule), now);
}

/**
 * Single place for usage rules (spec §3.1).
 * Returns which features the home screen may offer right now.
 */
export function getAllowedFeatures(
  group: UserGroup,
  schedule: ClassSchedule | null | undefined,
  now: Date = new Date(),
): Feature[] {
  const effective = getEffectiveClassSchedule(group, schedule);
  if (isPausedForClass(group, effective, now)) {
    return [];
  }

  if (group === "year-1-2") {
    // Objective and multiple-choice quiz is for Year 1–2 only (spec §3.2).
    return ["objective-quiz", "recitation-drill", "problem-drill"];
  }

  if (group === "year-3-4") {
    // During class hours, Quick Check is available; full drills stay available too.
    return ["in-class-quick-check", "recitation-drill", "problem-drill"];
  }

  if (isBarGroup(group)) {
    return ["recitation-drill", "problem-drill"];
  }

  return [];
}

/** Home feature order: Year 3–4 during class leads with Quick Check. */
export function getHomeFeatureOrder(
  group: UserGroup,
  schedule: ClassSchedule | null | undefined,
  now: Date = new Date(),
): Feature[] {
  const effective = getEffectiveClassSchedule(group, schedule);
  const allowed = getAllowedFeatures(group, effective, now);
  if (group !== "year-3-4") return allowed;

  const quick: Feature = "in-class-quick-check";
  const rest = allowed.filter((f) => f !== quick);
  const inClass = isDuringClassHours(effective, now);

  if (inClass && allowed.includes(quick)) {
    return [quick, ...rest];
  }
  if (allowed.includes(quick)) {
    return [...rest, quick];
  }
  return rest;
}

export function canUseFeature(
  group: UserGroup,
  feature: Feature,
  schedule: ClassSchedule | null | undefined,
  now: Date = new Date(),
): boolean {
  return getAllowedFeatures(group, schedule, now).includes(feature);
}

export function getUsageNotice(group: UserGroup): string {
  return USAGE_NOTICES[group];
}

export function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return hours * 60 + minutes;
}
