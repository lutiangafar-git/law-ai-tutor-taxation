import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

function topicFile(opts: {
  topicId: string;
  subject: string;
  yearLevels: string;
  status?: string;
  reviewedBy?: string;
  lastReviewed?: string;
}): string {
  return `---
topicId: ${opts.topicId}
title: "${opts.topicId} title"
subject: ${opts.subject}
yearLevels: ${opts.yearLevels}
${opts.status ? `status: ${opts.status}\n` : ""}citation: "Civil Code, Article 1"
link: "https://example.com/source"
reviewedBy: "${opts.reviewedBy ?? ""}"
lastReviewed: "${opts.lastReviewed ?? ""}"
---

# Source text
Art. 1. Example.

# Key points for the tutor (reviewer-approved)
- Example point.

# Recitation drill: application fact pattern
Scenario: Example scenario.
Model answer: Example answer.

# Problem drill: exam or bar-style problem
Problem: Example problem?
Model answer:
- Answer: Yes.
- Legal basis: Art. 1.
- Application: Facts meet law.
- Conclusion: Yes.
`;
}

const temps: string[] = [];

async function loadWith(files: Record<string, string>) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "law-years-"));
  temps.push(project);
  fs.mkdirSync(path.join(project, "sources"));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(project, "sources", name), body);
  }
  vi.spyOn(process, "cwd").mockReturnValue(project);
  return import("@/lib/sources");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const civilLawFiles = {
  "persons.md": topicFile({
    topicId: "persons",
    subject: "Persons and Family Relations",
    yearLevels: "[year-1, year-4, bar]",
    status: "demo",
  }),
  "sales.md": topicFile({
    topicId: "sales",
    subject: "Sales",
    yearLevels: "[year-2, year-4, bar]",
    status: "demo",
  }),
  "succession.md": topicFile({
    topicId: "succession",
    subject: "Succession",
    yearLevels: "[year-3, year-4, bar]",
    reviewedBy: "Atty. Reviewer",
    lastReviewed: "2026-11-11",
  }),
  "hidden.md": topicFile({
    topicId: "hidden",
    subject: "Sales",
    yearLevels: "[year-2, bar]",
  }),
};

describe("topics by law school year", () => {
  it("Year 1 sees Persons, not Sales or Succession", async () => {
    const { getTopicsForGroup } = await loadWith(civilLawFiles);
    const ids = getTopicsForGroup("year-1-2", 1).map((t) => t.topicId);
    expect(ids).toEqual(["persons"]);
  });

  it("Year 2 sees Sales only", async () => {
    const { getTopicsForGroup } = await loadWith(civilLawFiles);
    expect(getTopicsForGroup("year-1-2", 2).map((t) => t.topicId)).toEqual(["sales"]);
  });

  it("Year 3 sees Succession only", async () => {
    const { getTopicsForGroup } = await loadWith(civilLawFiles);
    expect(getTopicsForGroup("year-3-4", 3).map((t) => t.topicId)).toEqual(["succession"]);
  });

  it("Year 4 and both bar groups see all of Civil Law", async () => {
    const { getTopicsForGroup } = await loadWith(civilLawFiles);
    const all = ["persons", "sales", "succession"];
    expect(getTopicsForGroup("year-3-4", 4).map((t) => t.topicId).sort()).toEqual(all);
    expect(getTopicsForGroup("bar-first-time").map((t) => t.topicId).sort()).toEqual(all);
    expect(getTopicsForGroup("bar-repeater").map((t) => t.topicId).sort()).toEqual(all);
  });

  it("a student with no saved year sees both years of their pair", async () => {
    const { getTopicsForGroup } = await loadWith(civilLawFiles);
    expect(getTopicsForGroup("year-1-2").map((t) => t.topicId).sort()).toEqual([
      "persons",
      "sales",
    ]);
  });

  it("a topic outside the student's year cannot be opened by id", async () => {
    const { getTopicById } = await loadWith(civilLawFiles);
    expect(getTopicById("sales", "year-1-2", 1)).toBeNull();
    expect(getTopicById("sales", "year-1-2", 2)?.topicId).toBe("sales");
  });

  it("parseStudentYear accepts only 1–4", async () => {
    const { parseStudentYear } = await loadWith({});
    expect(parseStudentYear("2")).toBe(2);
    expect(parseStudentYear("5")).toBeNull();
    expect(parseStudentYear("abc")).toBeNull();
    expect(parseStudentYear(null)).toBeNull();
  });
});

describe("demo topics (status: demo)", () => {
  it("are shown, flagged as demo, with the pending-review label", async () => {
    const { getTopicById, DEMO_REVIEW_LABEL, toClientTopicSummary } =
      await loadWith(civilLawFiles);
    const topic = getTopicById("persons");
    expect(topic?.isDemo).toBe(true);
    expect(topic?.reviewedBy).toBe(DEMO_REVIEW_LABEL);
    expect(toClientTopicSummary(topic!).isDemo).toBe(true);
  });

  it("reviewed topics are not flagged as demo", async () => {
    const { getTopicById } = await loadWith(civilLawFiles);
    const topic = getTopicById("succession");
    expect(topic?.isDemo).toBe(false);
    expect(topic?.reviewedBy).toBe("Atty. Reviewer");
  });

  it("topics that are neither reviewed nor demo stay hidden (criterion 8)", async () => {
    const { loadAllReviewedTopics } = await loadWith(civilLawFiles);
    expect(loadAllReviewedTopics().map((t) => t.topicId)).not.toContain("hidden");
  });

  it("the client summary never includes model answers", async () => {
    const { getTopicById, toClientTopicSummary } = await loadWith(civilLawFiles);
    const summary = toClientTopicSummary(getTopicById("sales")!) as Record<string, unknown>;
    expect(summary.modelAnswer).toBeUndefined();
    expect(summary.problem).toBeUndefined();
  });
});

describe("saving the student's year", () => {
  it("Year 2 is stored with the Year 1–2 usage group; bar reviewees have no year", async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    const { setUserGroup } = await import("@/lib/storage");

    const student = setUserGroup("year-1-2", 2);
    expect(student.userGroup).toBe("year-1-2");
    expect(student.studentYear).toBe(2);

    const bar = setUserGroup("bar-repeater", 3);
    expect(bar.studentYear).toBeNull();
    vi.unstubAllGlobals();
  });

  it("each profile option maps to the right usage group", async () => {
    const { PROFILE_OPTIONS, findProfileKey } = await import("@/lib/profiles");
    for (const p of PROFILE_OPTIONS) {
      if (p.year === null) expect(p.group).toMatch(/^bar-/);
      else expect(p.group).toBe(p.year <= 2 ? "year-1-2" : "year-3-4");
    }
    expect(findProfileKey("year-3-4", 4)).toBe("year-4");
    const firstEarly = PROFILE_OPTIONS.find((p) => p.group === "year-1-2");
    if (firstEarly) expect(findProfileKey("year-1-2", null)).toBe(firstEarly.key);
  });
});

describe("topic order", () => {
  it("without syllabus references, topics follow the subject-area order in lib/subject.ts", async () => {
    const { loadAllReviewedTopics } = await loadWith(civilLawFiles);
    const { SUBJECT } = await import("@/lib/subject");
    const got = loadAllReviewedTopics().map((t) => t.subject);
    const ranks = got.map((s) => SUBJECT.areas.indexOf(s));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
