import { decodeHtmlBytes, htmlToText, tidyDecisionText } from "./decisions";

/** Largest upload accepted (Vercel limits request bodies to about 4.5 MB). */
export const MAX_UPLOAD_BYTES = 4_000_000;

/** Reads the text of an uploaded decision: PDF, HTML or plain text. */
export async function extractUploadText(name: string, type: string, bytes: Uint8Array): Promise<string> {
  const lower = name.toLowerCase();
  const isPdf = type === "application/pdf" || lower.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50);
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return tidyDecisionText(Array.isArray(text) ? text.join("\n") : text);
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm") || /html/i.test(type)) {
    return htmlToText(decodeHtmlBytes(bytes, type));
  }
  if (lower.endsWith(".txt") || /^text\//i.test(type)) {
    return tidyDecisionText(new TextDecoder("utf-8").decode(bytes));
  }
  throw new Error("Upload a PDF, HTML or text file of the decision. For Word files, save as PDF first.");
}
