import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, extractUploadText } from "@/lib/extractUpload";
import { REVIEWER_MESSAGES, checkReviewerCode } from "@/lib/reviewerAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Reads the text of an uploaded decision (PDF, HTML or text) so the reviewer can check it before drafting. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload did not arrive. Try again." }, { status: 400 });
  }
  const auth = checkReviewerCode(form.get("code"));
  if (auth !== "ok") {
    const { status, error } = REVIEWER_MESSAGES[auth];
    return NextResponse.json({ error }, { status });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That file is larger than 4 MB." }, { status: 413 });
  }
  try {
    const text = await extractUploadText(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
    if (text.length < 2000) {
      return NextResponse.json(
        { error: "Very little text came out of that file. If it is a scanned PDF, paste the text instead." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That file could not be read." },
      { status: 400 },
    );
  }
}
