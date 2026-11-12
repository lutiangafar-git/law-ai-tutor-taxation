import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyReviewerDetails,
  checkDecisionUrl,
  cutoffStatus,
  decodeHtmlBytes,
  extractDecisionMeta,
  htmlToText,
  toISODate,
} from "@/lib/decisions";
import { casesMissingCitation, checkDraft, longestSharedRun, quotedPassages, yearLevelsFor } from "@/lib/draftCheck";
import { extractUploadText } from "@/lib/extractUpload";
import { enforceDraftHeader } from "@/lib/prompts/decisionDraft";
import {
  approvedFileProblems,
  buildApprovedMarkdown,
  cleanReviewerName,
  manilaToday,
  publishTopicFile,
} from "@/lib/publish";
import { checkReviewerCode } from "@/lib/reviewerAuth";
import { parseTopicMarkdown } from "@/lib/sources";
import { SUBJECT } from "@/lib/subject";

/**
 * Same test file in the Civil, Commercial and Taxation apps. Each app keeps its own sample:
 * tests/fixtures/review-draft.md (a checked draft) and review-decision.txt (a short excerpt of
 * the decision it was drafted from; the last line is a line of the decision's facts).
 */
const FIX = path.join(process.cwd(), "tests", "fixtures");
const decision = fs.readFileSync(path.join(FIX, "review-decision.txt"), "utf8");
const draft = fs.readFileSync(path.join(FIX, "review-draft.md"), "utf8").replace(/\r\n?/g, "\n");
const meta = extractDecisionMeta(decision);
const topic = parseTopicMarkdown(draft, "x", { includeDrafts: true })!;
const errorsOf = (md: string) => checkDraft(md, decision, meta).filter((i) => i.level === "error");
const FULL_CITE = /([A-Z][\w.'ñÑ&-]*(?: [\w.'ñÑ&-]+)* v\. [^,\n]+), G\.R\. Nos?\. [0-9][0-9, &-]*, [A-Z][a-z]+\.? \d{1,2}, \d{4}/;

describe("decision links", () => {
  it("accepts LawPhil and SC E-Library over https", () => {
    expect(checkDecisionUrl("https://lawphil.net/judjuris/juri2026/apr2026/gr_249759_2026.html").ok).toBe(true);
    expect(checkDecisionUrl("https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/12345").ok).toBe(true);
  });
  it.each([
    "http://lawphil.net/x.html",
    "https://example.com/gr.html",
    "https://lawphil.net.evil.com/x",
    "https://lawphil.net:8443/x",
    "https://user:pw@lawphil.net/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "not a url",
  ])("rejects %s", (url) => {
    expect(checkDecisionUrl(url).ok).toBe(false);
  });
});

describe("reading a decision", () => {
  it("decodes LawPhil's windows-1252 text (ñ)", () => {
    const bytes = new Uint8Array([0x44, 0x69, 0xf1, 0x6f]); // "Diño" in windows-1252
    expect(decodeHtmlBytes(bytes, "text/html")).toBe("Diño");
  });
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>Di&ntilde;o&nbsp;v. Di&#241;o</p><!-- note --><script>x</script>")).toBe("Diño v. Diño");
  });
  it("reads the sample decision's G.R. number, date and parties", () => {
    expect(meta.grNumber).toMatch(/^G\.R\. No\. \d+/);
    expect(meta.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meta.parties).toMatch(/ vs?\. /i);
    expect(meta.kind).toBe("decision");
    const citation = String(matter(draft).data.citation);
    expect(citation).toContain(meta.grNumber!);
    expect(citation).toContain(meta.date!);
  });
  it("reads the ponente and division of a LawPhil decision", () => {
    const m = extractDecisionMeta(
      "FIRST DIVISION\nG.R. No. 249759, April 22, 2026\nJUANITO B. SOTO, PETITIONER,\nvs.\nCASSANDRA REYES-SOTO, RESPONDENT.\nD E C I S I O N\nROSARIO, J.:\nThis is a petition.",
    );
    expect(m).toMatchObject({ grNumber: "G.R. No. 249759", date: "April 22, 2026", ponente: "ROSARIO", division: "FIRST DIVISION" });
  });
  it("spots a separate opinion", () => {
    const text = "G.R. No. 258524, April 8, 2026\nCONCURRING OPINION\nLEONEN, J.:\nI concur.";
    expect(extractDecisionMeta(text).kind).toBe("separate-opinion");
  });
  it("parses dates", () => {
    expect(toISODate("June 30, 2026")).toBe("2026-06-30");
    expect(toISODate("Sept. 5, 2025")).toBe("2025-09-05");
    expect(toISODate("soon")).toBeNull();
    expect(toISODate("Apr 22 2026")).toBe("2026-04-22");
  });
});

describe("case details typed by the reviewer", () => {
  it("what the reviewer types wins over what was read", () => {
    const { meta: m, problems } = applyReviewerDetails(meta, {
      caseTitle: "Juan v. Pedro",
      grNumber: "123456",
      date: "May 5, 2026",
    });
    expect(problems).toEqual([]);
    expect(m).toMatchObject({ title: "Juan v. Pedro", grNumber: "G.R. No. 123456", date: "May 5, 2026", dateISO: "2026-05-05" });
  });
  it("writes a typed date out in full", () => {
    expect(applyReviewerDetails(meta, { date: "Apr 22 2026" }).meta.date).toBe("April 22, 2026");
  });
  it("blank boxes keep what was read from the decision", () => {
    expect(applyReviewerDetails(meta, {}).meta.grNumber).toBe(meta.grNumber);
  });
  it("explains badly typed details", () => {
    const { problems } = applyReviewerDetails(meta, { caseTitle: "Juan and Pedro", grNumber: "abc", date: "next week" });
    expect(problems).toHaveLength(3);
  });
});

describe("uploaded files", () => {
  const long = "G.R. No. 1, January 1, 2026\n" + "word ".repeat(500);
  it("reads text and HTML files", async () => {
    expect(await extractUploadText("d.txt", "text/plain", new TextEncoder().encode(long))).toContain("G.R. No. 1");
    const html = new TextEncoder().encode(`<html><body><p>${long}</p></body></html>`);
    expect(await extractUploadText("d.html", "text/html", html)).toContain("G.R. No. 1");
  });
  it("refuses other file types", async () => {
    await expect(extractUploadText("d.docx", "application/octet-stream", new Uint8Array([1, 2, 3]))).rejects.toThrow(/PDF/);
  });
});

describe("Bar cut-off", () => {
  it("a decision on or before the cut-off counts for this Bar", () => {
    expect(cutoffStatus("2026-04-22")).toMatchObject({ barYear: 2027, inCurrentBar: true });
    expect(cutoffStatus("2026-06-30").inCurrentBar).toBe(true);
  });
  it("a later decision is kept for the next Bar", () => {
    expect(cutoffStatus("2026-07-01")).toMatchObject({ barYear: 2028, inCurrentBar: false });
  });
  it("an unreadable date is flagged", () => {
    expect(cutoffStatus(null).barYear).toBeNull();
  });
});

describe("Bar-exam paragraph model answers", () => {
  it("reads (Answer) (Legal basis) (Application) (Conclusion) paragraphs", () => {
    const ma = topic.modelAnswer;
    for (const part of [ma.answer, ma.legalBasis, ma.application, ma.conclusion]) {
      expect(part.length).toBeGreaterThan(10);
      expect(part).not.toMatch(/\((Answer|Legal basis|Application|Conclusion)\)/);
    }
  });
  it("still reads the older bullet form", () => {
    const old = draft.replace(
      /Model answer:\n\(Answer\)[\s\S]*?(?=\n# )/,
      "Model answer:\n- Answer: A.\n- Legal basis: B.\n- Application: C.\n- Conclusion: D.\n",
    );
    const t = parseTopicMarkdown(old, "x", { includeDrafts: true })!;
    expect(t.modelAnswer).toEqual({ answer: "A.", legalBasis: "B.", application: "C.", conclusion: "D." });
  });
});

describe("draft checks", () => {
  it("the sample draft passes every check", () => {
    expect(checkDraft(draft, decision, meta)).toEqual([]);
  });
  it("catches a quote that is not word for word", () => {
    const quote = quotedPassages(draft)[0];
    expect(quote).toBeTruthy();
    const bad = draft.replace(quote, quote.replace(/\b([A-Za-z]{4,})\b/, "$1zz"));
    expect(errorsOf(bad).some((i) => i.message.startsWith("This quote is not word for word"))).toBe(true);
  });
  it("catches a case named without its G.R. number and date", () => {
    const body = matter(draft).content;
    const m = FULL_CITE.exec(body);
    expect(m).toBeTruthy();
    const bad = draft.replace(body, body.replace(m![0], m![1]));
    expect(errorsOf(bad).some((i) => i.message.includes("needs its title, G.R. number and date"))).toBe(true);
  });
  it("finds cases missing a citation", () => {
    expect(casesMissingCitation("As held in Tan-Andal v. Andal, the rule is clear.")).toEqual(["Tan-Andal v. Andal"]);
    expect(casesMissingCitation("Tan-Andal v. Andal, G.R. No. 196359, May 11, 2021")).toEqual([]);
    expect(casesMissingCitation("(Tan-Andal v. Andal; Soto v. Reyes-Soto, G.R. No. 249759, April 22, 2026)")).toEqual([
      "Tan-Andal v. Andal",
    ]);
  });
  it("pairs quotation marks in order, so text between two short quotes is not a quote", () => {
    expect(quotedPassages('# Source text\nThe "other matters" clause is broad and residual, and a CIR "decision" is not needed.')).toEqual([]);
  });
  it("reads case titles with a slash", () => {
    const cite = "Commissioner of Internal Revenue v. Elric Auxiliary Services Corporation/Sacred Heart Gas Station, G.R. No. 226945, February 19, 2026";
    expect(casesMissingCitation(cite)).toEqual([]);
    expect(casesMissingCitation("Commissioner of Internal Revenue v. Elric Auxiliary Services Corporation/Sacred Heart Gas Station said so.")).toHaveLength(1);
  });
  it("a draft must stay status: draft with empty sign-off fields", () => {
    expect(errorsOf(draft.replace("status: draft", "status: demo")).length).toBeGreaterThan(0);
    expect(errorsOf(draft.replace('reviewedBy: ""', 'reviewedBy: "Atty. X"')).length).toBeGreaterThan(0);
  });
  it("year levels follow the year plan in lib/subject.ts", () => {
    for (const area of SUBJECT.areas) {
      const tags = yearLevelsFor(area);
      expect(tags.slice(-2)).toEqual(["year-4", "bar"]);
      for (const y of [1, 2, 3] as const) {
        expect(tags.includes(`year-${y}` as never)).toBe(SUBJECT.yearAreas[y].includes(area));
      }
    }
    expect(topic.yearLevels).toEqual(yearLevelsFor(topic.subject));
    expect(errorsOf(draft.replace(/^yearLevels:.*$/m, "yearLevels: [bar]")).length).toBeGreaterThan(0);
  });
  it("a subject outside this app is rejected", () => {
    expect(errorsOf(draft.replace(/^subject:.*$/m, "subject: Not A Real Area")).length).toBeGreaterThan(0);
  });
  it("the citation must carry the decision's G.R. number and date", () => {
    const bad = draft.replace(/^citation:.*$/m, 'citation: "Some statute, Section 1"');
    expect(errorsOf(bad).filter((i) => i.message.startsWith("citation must")).length).toBe(2);
  });
  it.skipIf(!topic.yearLevels.some((y) => y === "year-1" || y === "year-2"))("Year 1-2 drafts need the quiz", () => {
    const noQuiz = draft.split("# Objective and multiple-choice quiz")[0];
    expect(errorsOf(noQuiz).some((i) => i.message.includes("quiz items"))).toBe(true);
  });
  it("a model answer missing a paragraph is rejected", () => {
    const bad = draft.replace(/\n\(Conclusion\)[^\n]*\n/, "\n");
    expect(errorsOf(bad).some((i) => i.message.includes("(Conclusion)"))).toBe(true);
  });
  it("warns when the problem copies the decision's facts", () => {
    const facts = decision.trim().split("\n").pop()!;
    const copied = draft.replace(/^(Problem: .*)$/m, (line) => `${line} ${facts}`);
    expect(checkDraft(copied, decision, meta).some((i) => i.level === "warning" && i.message.includes("words in a row"))).toBe(true);
    expect(longestSharedRun("totally new facts here", decision)).toBe(0);
  });
});

describe("header the app fills in", () => {
  it("forces draft status, year levels and empty sign-off, and drops a code fence", () => {
    const area = SUBJECT.areas[0];
    const raw = `\`\`\`markdown\n---\ntopicId: x\nsubject: ${area}\nyearLevels: [bar]\nstatus: demo\nreviewedBy: "Someone"\nlastReviewed: "2026-01-01"\n---\n# Source text\nx\n\`\`\``;
    const md = enforceDraftHeader(raw, yearLevelsFor(area));
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain(`yearLevels: [${yearLevelsFor(area).join(", ")}]`);
    expect(md).toContain("status: draft");
    expect(md).toContain('reviewedBy: ""');
    expect(md).toContain('lastReviewed: ""');
    expect(md).not.toContain("```");
  });
});

describe("approve and publish", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    for (const key of ["GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH"]) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("writes the reviewer's name and date and removes the draft status", () => {
    const approved = buildApprovedMarkdown(draft, "Atty. Test Reviewer", "2026-11-12");
    expect(approved).not.toMatch(/^status:/m);
    expect(approved).toContain('reviewedBy: "Atty. Test Reviewer"');
    expect(approved).toContain('lastReviewed: "2026-11-12"');
    const t = parseTopicMarkdown(approved, "x")!;
    expect(t.isDemo).toBe(false);
    expect(t.reviewedBy).toBe("Atty. Test Reviewer");
    expect(t.lastReviewed).toBe("2026-11-12");
    expect(approvedFileProblems(approved)).toEqual([]);
  });
  it("an unapproved draft would stay hidden", () => {
    expect(approvedFileProblems(draft).length).toBeGreaterThan(0);
  });
  it("cleans the reviewer's name", () => {
    expect(cleanReviewerName('  Atty. "Juan"\nDela: Cruz ')).toBe("Atty. Juan Dela Cruz");
  });
  it("uses the date in the Philippines", () => {
    expect(manilaToday(new Date("2026-11-12T20:00:00Z"))).toBe("2026-11-13");
  });
  it("is switched off without a GitHub token", async () => {
    delete process.env.GITHUB_TOKEN;
    const r = await publishTopicFile({ topicId: "abc-123", markdown: "x", message: "m" });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
  it("saves a new topic file to /sources on GitHub", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPO = "owner/repo";
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init?.method) return new Response("", { status: 404 });
      return new Response(JSON.stringify({ commit: { html_url: "https://github.com/c/1" } }), { status: 201 });
    }) as typeof fetch;
    const r = await publishTopicFile({ topicId: "abc-123", markdown: "hello ñ", message: "Add topic", fetchImpl: fakeFetch });
    expect(r).toEqual({ ok: true, path: "sources/abc-123.md", commitUrl: "https://github.com/c/1" });
    expect(calls[1].url).toBe("https://api.github.com/repos/owner/repo/contents/sources/abc-123.md");
    const sent = JSON.parse(String(calls[1].init!.body));
    expect(Buffer.from(sent.content, "base64").toString("utf8")).toBe("hello ñ");
    expect(sent.branch).toBe("main");
  });
  it("never overwrites an existing topic", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPO = "owner/repo";
    const fakeFetch = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const r = await publishTopicFile({ topicId: "abc-123", markdown: "x", message: "m", fetchImpl: fakeFetch });
    expect(r).toMatchObject({ ok: false, status: 409 });
  });
  it("refuses a bad topicId", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPO = "owner/repo";
    const r = await publishTopicFile({ topicId: "../evil", markdown: "x", message: "m" });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });
});

describe("reviewer passcode", () => {
  const saved = process.env.REVIEWER_CODE;
  afterEach(() => {
    if (saved === undefined) delete process.env.REVIEWER_CODE;
    else process.env.REVIEWER_CODE = saved;
  });
  it("is switched off when no passcode is set", () => {
    delete process.env.REVIEWER_CODE;
    expect(checkReviewerCode("anything")).toBe("not-set-up");
  });
  it("is switched off when the passcode is too short", () => {
    process.env.REVIEWER_CODE = "short";
    expect(checkReviewerCode("short")).toBe("not-set-up");
  });
  it("accepts only the right passcode", () => {
    process.env.REVIEWER_CODE = "correct-horse-battery";
    expect(checkReviewerCode("correct-horse-battery")).toBe("ok");
    expect(checkReviewerCode("wrong")).toBe("wrong-code");
    expect(checkReviewerCode(undefined)).toBe("wrong-code");
  });
});
