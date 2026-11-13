import { NextResponse } from "next/server";
import { OUTLINE, questionsFor } from "@/lib/bank";

/** GET /api/bank?code=VIII.A&kind=basic|bar|all - questions for a syllabus area or line. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "basic" || kindParam === "bar" ? kindParam : "all";
  if (!OUTLINE.some((o) => o.code === code)) {
    return NextResponse.json({ error: "Unknown syllabus code" }, { status: 400 });
  }
  return NextResponse.json({ questions: questionsFor(code, kind) });
}
