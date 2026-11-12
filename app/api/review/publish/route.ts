import { NextResponse } from "next/server";
import { applyReviewerDetails, extractDecisionMeta } from "@/lib/decisions";
import { checkDraft } from "@/lib/draftCheck";
import {
  approvedFileProblems,
  buildApprovedMarkdown,
  cleanReviewerName,
  manilaToday,
  publishTopicFile,
  topicIdOf,
} from "@/lib/publish";
import { REVIEWER_MESSAGES, checkReviewerCode } from "@/lib/reviewerAuth";
import { loadAllReviewedTopics } from "@/lib/sources";

export const runtime = "nodejs";

const MAX_CHARS = 600_000;

/** Approve and publish: re-checks the draft, writes the sign-off, saves it to /sources on GitHub. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    markdown?: string;
    decisionText?: string;
    reviewerName?: string;
    confirmed?: boolean;
    details?: { caseTitle?: string; grNumber?: string; date?: string };
  };
  const auth = checkReviewerCode(body.code);
  if (auth !== "ok") {
    const { status, error } = REVIEWER_MESSAGES[auth];
    return NextResponse.json({ error }, { status });
  }

  const reviewer = cleanReviewerName(body.reviewerName);
  if (reviewer.length < 3) return NextResponse.json({ error: "Type your name as reviewer." }, { status: 400 });
  if (body.confirmed !== true) {
    return NextResponse.json({ error: "Tick the box to confirm you checked the law." }, { status: 400 });
  }

  const markdown = String(body.markdown ?? "").slice(0, MAX_CHARS);
  const decisionText = String(body.decisionText ?? "").slice(0, MAX_CHARS);
  if (!markdown || !decisionText) return NextResponse.json({ error: "Nothing to publish." }, { status: 400 });

  const { meta } = applyReviewerDetails(extractDecisionMeta(decisionText), body.details ?? {});
  const errors = checkDraft(markdown, decisionText, meta).filter((i) => i.level === "error");
  if (errors.length > 0) {
    return NextResponse.json({ error: "Fix the 'Must fix' items first.", issues: errors }, { status: 422 });
  }

  const dateISO = manilaToday();
  const approved = buildApprovedMarkdown(markdown, reviewer, dateISO);
  const problems = approvedFileProblems(approved);
  if (problems.length > 0) return NextResponse.json({ error: problems.join(" ") }, { status: 422 });

  const topicId = topicIdOf(approved);
  if (loadAllReviewedTopics().some((t) => t.topicId === topicId)) {
    return NextResponse.json(
      { error: `A topic named ${topicId} is already live. Change the topicId and try again.` },
      { status: 409 },
    );
  }

  const title = /^title:\s*"?(.*?)"?\s*$/m.exec(approved)?.[1] ?? topicId;
  const result = await publishTopicFile({
    topicId,
    markdown: approved,
    message: `Add reviewed topic: ${title.slice(0, 120)}\n\nApproved by ${reviewer} on ${dateISO} with the reviewer tool.`,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, approvedMarkdown: approved }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    path: result.path,
    commitUrl: result.commitUrl,
    approvedMarkdown: approved,
    reviewer,
    dateISO,
  });
}
