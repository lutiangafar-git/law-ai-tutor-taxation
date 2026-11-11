import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const reviewed = `---
topicId: oblicon-art-1156
title: "Civil Code, Article 1156: Definition of an obligation"
subject: Obligations and Contracts
yearLevels: [year-1-2, bar]
citation: "Civil Code of the Philippines, Article 1156"
link: "https://example.com/source"
reviewedBy: "Reviewer Name"
lastReviewed: "2026-11-15"
---

# Source text
Art. 1156. An obligation is a juridical necessity to give, to do or not to do.

# Key points for the tutor (reviewer-approved)
- An obligation is a juridical necessity.

# Recitation drill: application fact pattern
Scenario: A promises to deliver a book.
Model answer: There is an obligation to give.

# Problem drill: exam or bar-style problem
Problem: Is there an obligation?
Model answer:
- Answer: Yes.
- Legal basis: Art. 1156.
- Application: The promise is to give.
- Conclusion: Obligation exists.
`;

const unreviewed = reviewed.replace(
  'reviewedBy: "Reviewer Name"\nlastReviewed: "2026-11-15"',
  'reviewedBy: ""\nlastReviewed: ""',
);

describe("sources loader (criterion 8)", () => {
  const temps: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    for (const dir of temps.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hides topics without lastReviewed / reviewedBy", async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "law-project-"));
    temps.push(project);
    fs.mkdirSync(path.join(project, "sources"));
    fs.writeFileSync(path.join(project, "sources", "hidden.md"), unreviewed);
    fs.writeFileSync(path.join(project, "sources", "visible.md"), reviewed);
    fs.writeFileSync(path.join(project, "sources", "_TEMPLATE.md"), unreviewed);

    vi.spyOn(process, "cwd").mockReturnValue(project);
    const { loadAllReviewedTopics, getTopicsForGroup } = await import(
      "@/lib/sources"
    );

    const all = loadAllReviewedTopics();
    expect(all).toHaveLength(1);
    expect(all[0].topicId).toBe("oblicon-art-1156");
    expect(getTopicsForGroup("year-1-2")).toHaveLength(1);
    expect(getTopicsForGroup("year-3-4")).toHaveLength(0);
    expect(getTopicsForGroup("bar-repeater")).toHaveLength(1);
  });
});
