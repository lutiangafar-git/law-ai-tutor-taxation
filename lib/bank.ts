/**
 * Question bank (spec v3, sections 3-5): original questions tagged to the lowest line of the
 * 2027 Bar syllabus. Each line has a basic question (multiple choice or objective, short answer,
 * no ALAC) and a bar problem (ALAC model answer). Built from Session_Tools/databank by
 * export_to_app.py. Status: draft, not yet lawyer-reviewed. Server-side only: the browser gets
 * questions through /api/bank, one topic at a time.
 */
import bank from "@/data/bank/taxation-bank.json";
import outline from "@/data/bank/taxation-outline.json";
import { isUnder, type BankQuestion, type OutlineItem } from "@/lib/bankShared";

export { isUnder, normalise } from "@/lib/bankShared";
export type { BankQuestion, OutlineItem } from "@/lib/bankShared";

export const OUTLINE = outline as OutlineItem[];
const BANK = bank as BankQuestion[];

/** Questions filed under a syllabus code (the code itself or any sub-item), in outline order. */
export function questionsFor(prefix: string, kind: "all" | "basic" | "bar" = "all"): BankQuestion[] {
  const order = new Map(OUTLINE.map((o, i) => [o.code, i]));
  return BANK.filter((q) => isUnder(q.ref, prefix))
    .filter((q) => kind === "all" || (kind === "bar" ? q.type === "bar" : q.type !== "bar"))
    .sort((a, b) => (order.get(a.ref) ?? 0) - (order.get(b.ref) ?? 0) || a.id.localeCompare(b.id));
}

export const BANK_TOTAL = BANK.length;
