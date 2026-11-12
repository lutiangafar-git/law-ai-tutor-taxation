import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkDraft, yearLevelsFor } from "@/lib/draftCheck";
import {
  applyReviewerDetails,
  cutoffStatus,
  extractDecisionMeta,
  fetchDecision,
  tidyDecisionText,
} from "@/lib/decisions";
import { logTutorEvent } from "@/lib/monitoring";
import {
  buildDecisionDraftSystemPrompt,
  buildDecisionDraftUserPrompt,
  enforceDraftHeader,
} from "@/lib/prompts/decisionDraft";
import { REVIEWER_MESSAGES, checkReviewerCode } from "@/lib/reviewerAuth";
import { SUBJECT } from "@/lib/subject";

export const runtime = "nodejs";
// Reading a long decision and drafting takes about 50 seconds; allow more (Vercel Fluid compute allows up to 300).
export const maxDuration = 180;

const DRAFT_MODEL = "claude-sonnet-5-5";
const MAX_TEXT_CHARS = 600_000;

type Body = {
  code?: string;
  /** A LawPhil or SC E-Library link, or */
  url?: string;
  /** the decision's text, pasted or read from an uploaded file. */
  text?: string;
  areaHint?: string;
  details?: { caseTitle?: string; grNumber?: string; date?: string };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const auth = checkReviewerCode(body.code);
  if (auth !== "ok") {
    const { status, error } = REVIEWER_MESSAGES[auth];
    return NextResponse.json({ error }, { status });
  }

  let text: string;
  let sourceUrl = "";
  const pasted = String(body.text ?? "").trim();
  if (pasted) {
    text = tidyDecisionText(pasted.slice(0, MAX_TEXT_CHARS));
  } else {
    try {
      const fetched = await fetchDecision(String(body.url ?? ""));
      text = fetched.text;
      sourceUrl = fetched.url;
    } catch (err) {
      const message =
        err instanceof Error && err.name !== "AbortError" ? err.message : "The site took too long to answer.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { meta, problems } = applyReviewerDetails(extractDecisionMeta(text), body.details ?? {});
  const cutoff = cutoffStatus(meta.dateISO);
  if (problems.length > 0) {
    return NextResponse.json({ error: problems.join(" "), meta, cutoff }, { status: 400 });
  }
  if (meta.kind === "separate-opinion") {
    return NextResponse.json(
      { error: "This is a separate opinion. Use the main decision instead.", meta, cutoff },
      { status: 400 },
    );
  }
  if (text.length < 2000) {
    return NextResponse.json({ error: "That is too little text to be a decision.", meta, cutoff }, { status: 400 });
  }
  if (!meta.grNumber || !meta.date) {
    return NextResponse.json(
      {
        error: "The G.R. number or date could not be read from the decision. Type them in the boxes and try again.",
        meta,
        cutoff,
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The AI key is not set up." }, { status: 503 });

  const started = Date.now();
  let draftText = "";
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 8000,
      system: buildDecisionDraftSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildDecisionDraftUserPrompt({
            url: sourceUrl || "(uploaded or pasted by the reviewer)",
            meta,
            text,
            areaHint: body.areaHint,
          }),
        },
      ],
    });
    logTutorEvent({
      event: "tutor_call",
      feature: "decision-draft",
      model: DRAFT_MODEL,
      ms: Date.now() - started,
      outcome: message.stop_reason ?? "unknown",
    });
    if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "The draft could not be finished. Try again." }, { status: 502 });
    }
    draftText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch {
    return NextResponse.json({ error: "The AI is unavailable right now. Try again in a minute." }, { status: 502 });
  }

  if (draftText.trim() === "NOT_IN_SCOPE") {
    return NextResponse.json(
      {
        error: `This decision does not apply a ${SUBJECT.subjectName} doctrine. Try it in the other subject apps.`,
        meta,
        cutoff,
      },
      { status: 422 },
    );
  }

  const subject = /^subject:\s*["']?(.+?)["']?\s*$/m.exec(draftText)?.[1] ?? "";
  const markdown = enforceDraftHeader(draftText, yearLevelsFor(subject));
  const issues = checkDraft(markdown, text, meta);
  if (!cutoff.inCurrentBar) issues.unshift({ level: "warning", message: cutoff.note });

  return NextResponse.json({ markdown, issues, meta, cutoff, decisionText: text, url: sourceUrl });
}
