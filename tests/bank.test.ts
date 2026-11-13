import { describe, expect, it } from "vitest";
import { BANK_TOTAL, OUTLINE, isUnder, normalise, questionsFor } from "@/lib/bank";

describe("question bank (spec v3, section 4)", () => {
  const leaves = OUTLINE.filter((o) => o.leaf);
  const all = questionsFor("I").concat(...OUTLINE.filter((o) => o.level === 1 && o.code !== "I").map((o) => questionsFor(o.code)));

  it("covers every lowest-level syllabus line with a basic question and a bar problem", () => {
    for (const line of leaves) {
      const qs = questionsFor(line.code);
      expect(qs.some((q) => q.type !== "bar"), `${line.code} basic`).toBe(true);
      expect(qs.some((q) => q.type === "bar"), `${line.code} bar`).toBe(true);
    }
  });

  it("files every question under a known lowest-level line", () => {
    expect(all.length).toBe(BANK_TOTAL);
    const leafCodes = new Set(leaves.map((l) => l.code));
    for (const q of all) expect(leafCodes.has(q.ref), q.id).toBe(true);
  });

  it("gives every multiple-choice question four choices and a valid answer", () => {
    for (const q of all.filter((x) => x.type === "mcq")) {
      expect(q.choices?.length, q.id).toBe(4);
      expect("ABCD".includes(q.correct ?? "x"), q.id).toBe(true);
    }
  });

  it("gives every bar problem all four ALAC parts and every case a G.R. number and date", () => {
    for (const q of all.filter((x) => x.type === "bar")) {
      expect(q.alac?.answer && q.alac.basis && q.alac.application && q.alac.conclusion, q.id).toBeTruthy();
    }
    for (const q of all) {
      for (const part of (q.cite ?? "").split(";")) {
        if (/\bv\.\s/.test(part)) {
          expect(part, q.id).toMatch(/G\.R\. No/);
          expect(part, q.id).toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/);
        }
      }
    }
  });

  it("matches objective answers loosely and nests codes correctly", () => {
    expect(normalise("  No One. ")).toBe("no one");
    expect(isUnder("VIII.A.5.f.ii", "VIII")).toBe(true);
    expect(isUnder("VIII.A.5", "VIII.A.5.f")).toBe(false);
    expect(isUnder("IX.A", "I")).toBe(false);
  });
});
