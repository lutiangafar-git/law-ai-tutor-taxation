import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Year 1–2 must not skip ahead by opening a page from a link: the recitation and problem
 * pages are wrapped in StepGuard, which applies the same locks as the drills page
 * (rules tested in topic-order.test.ts).
 */
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("step locks are enforced on the pages themselves", () => {
  it("the recitation page is guarded", () => {
    expect(read("app/recitation/[topicId]/page.tsx")).toContain('<StepGuard step="recitation-drill">');
  });
  it("the problem page is guarded", () => {
    expect(read("app/problem/[topicId]/page.tsx")).toContain('<StepGuard step="problem-drill">');
  });
  it("the guard uses the shared lock rules", () => {
    expect(read("components/StepGuard.tsx")).toContain("topicSteps(state.userGroup, topicId, state)[step]");
  });
});
