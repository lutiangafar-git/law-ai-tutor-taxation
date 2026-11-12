import { NextResponse } from "next/server";
import { checkDraft } from "@/lib/draftCheck";
import { applyReviewerDetails, cutoffStatus, extractDecisionMeta } from "@/lib/decisions";
import { REVIEWER_MESSAGES, checkReviewerCode } from "@/lib/reviewerAuth";

export const runtime = "nodejs";

const MAX_CHARS = 600_000;

/** Re-checks a draft after the reviewer edits it. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    markdown?: string;
    decisionText?: string;
    details?: { caseTitle?: string; grNumber?: string; date?: string };
  };
  const auth = checkReviewerCode(body.code);
  if (auth !== "ok") {
    const { status, error } = REVIEWER_MESSAGES[auth];
    return NextResponse.json({ error }, { status });
  }
  const markdown = String(body.markdown ?? "").slice(0, MAX_CHARS);
  const decisionText = String(body.decisionText ?? "").slice(0, MAX_CHARS);
  if (!markdown || !decisionText) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });

  const { meta } = applyReviewerDetails(extractDecisionMeta(decisionText), body.details ?? {});
  const cutoff = cutoffStatus(meta.dateISO);
  const issues = checkDraft(markdown, decisionText, meta);
  if (!cutoff.inCurrentBar) issues.unshift({ level: "warning", message: cutoff.note });
  return NextResponse.json({ issues });
}
