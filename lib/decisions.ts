import { BAR_EXAM } from "./barExam";

/**
 * Fetching and reading Supreme Court decisions for the reviewer's draft tool.
 * Only these hosts may be fetched, so the server cannot be pointed at anything else.
 * (sc.judiciary.gov.ph blocks automated access; LawPhil and the SC E-Library do not.)
 */
export const ALLOWED_DECISION_HOSTS = [
  "lawphil.net",
  "www.lawphil.net",
  "elibrary.judiciary.gov.ph",
] as const;

const MAX_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

export function checkDecisionUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    return { ok: false, reason: "That is not a web address. Paste the full link to the decision." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "The link must start with https://." };
  }
  if (url.username || url.password || url.port) {
    return { ok: false, reason: "That link is not allowed." };
  }
  if (!(ALLOWED_DECISION_HOSTS as readonly string[]).includes(url.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: "Only LawPhil (lawphil.net) and SC E-Library (elibrary.judiciary.gov.ph) links are accepted.",
    };
  }
  return { ok: true, url };
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  ntilde: "ñ", Ntilde: "Ñ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", sect: "§", eacute: "é", aacute: "á",
  iacute: "í", oacute: "ó", uacute: "ú", Eacute: "É", THORN: "Þ", thorn: "þ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

/** Turns decision HTML into plain text, one paragraph per line. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|blockquote|center)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** LawPhil pages are windows-1252; others declare UTF-8. */
export function decodeHtmlBytes(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1] ?? /charset=["']?([\w-]+)/i.exec(head)?.[1];
  const label = declared && /utf-?8/i.test(declared) ? "utf-8" : "windows-1252";
  return new TextDecoder(label).decode(bytes);
}

export interface DecisionMeta {
  /** e.g. "G.R. No. 249759" */
  grNumber: string | null;
  /** As written in the decision, e.g. "April 22, 2026" */
  date: string | null;
  /** yyyy-mm-dd, or null if the date could not be read */
  dateISO: string | null;
  ponente: string | null;
  division: string | null;
  /** The parties line as written, e.g. "JUANITO B. SOTO, PETITIONER, vs. ..." */
  parties: string | null;
  /** "decision" | "resolution" | "separate-opinion" | "unknown" */
  kind: "decision" | "resolution" | "separate-opinion" | "unknown";
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_NAMES = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));

export function toISODate(date: string): string | null {
  const m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(date.trim().replace(/,(\S)/, ", $1"));
  if (!m) return null;
  const month = MONTHS.findIndex((name) => name.startsWith(m[1].toLowerCase().slice(0, 3)));
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function extractDecisionMeta(text: string): DecisionMeta {
  const top = text.slice(0, 6000);
  const gr = /G\.\s*R\.\s*Nos?\.\s*([0-9][0-9\s,&\-and]*[0-9])\s*,\s*([A-Z][a-z]+\.?\s+\d{1,2},\s*\d{4})/.exec(top);
  const grNumber = gr ? `G.R. No. ${gr[1].replace(/\s+/g, " ").trim()}` : null;
  const date = gr ? gr[2].replace(/\s+/g, " ") : null;

  const ponente = /^([A-Z][A-ZÑ.'\- ,]+?), *(?:C\. *)?J\. *:/m.exec(top)?.[1]?.trim() ?? null;
  const division = /^(EN BANC|(?:FIRST|SECOND|THIRD) DIVISION|SPECIAL [A-Z ]+DIVISION)$/m.exec(top)?.[1] ?? null;

  const head = top.slice(0, 2500).toUpperCase();
  let kind: DecisionMeta["kind"] = "unknown";
  if (/(CONCURRING|DISSENTING|SEPARATE)\s+OPINION/.test(head)) kind = "separate-opinion";
  else if (/D\s?E\s?C\s?I\s?S\s?I\s?O\s?N/.test(head)) kind = "decision";
  else if (/R\s?E\s?S\s?O\s?L\s?U\s?T\s?I\s?O\s?N/.test(head)) kind = "resolution";

  let parties: string | null = null;
  if (gr) {
    const after = top.slice(gr.index + gr[0].length);
    const end = after.search(/\n\s*(D\s?E\s?C\s?I\s?S\s?I\s?O\s?N|R\s?E\s?S\s?O\s?L\s?U\s?T\s?I\s?O\s?N)\s*\n/);
    if (end > 0) parties = after.slice(0, end).replace(/\s+/g, " ").trim().slice(0, 400) || null;
  }

  return { grNumber, date, dateISO: date ? toISODate(date) : null, ponente, division, parties, kind };
}

export interface CutoffStatus {
  /** Bar exam year this decision counts for. */
  barYear: number | null;
  inCurrentBar: boolean;
  note: string;
}

/** Decisions promulgated on or before the cut-off count for this Bar; later ones for the next. */
export function cutoffStatus(dateISO: string | null): CutoffStatus {
  const cutoffISO = toISODate(BAR_EXAM.cutoff);
  if (!dateISO || !cutoffISO) {
    return { barYear: null, inCurrentBar: false, note: "The decision date could not be read. Check it by hand." };
  }
  if (dateISO <= cutoffISO) {
    return {
      barYear: BAR_EXAM.year,
      inCurrentBar: true,
      note: `Promulgated on or before ${BAR_EXAM.cutoff}: covered by the ${BAR_EXAM.year} Bar.`,
    };
  }
  return {
    barYear: BAR_EXAM.year + 1,
    inCurrentBar: false,
    note: `Promulgated after the ${BAR_EXAM.year} Bar cut-off (${BAR_EXAM.cutoff}). Keep it for the ${BAR_EXAM.year + 1} Bar; do not add it to this year's drills.`,
  };
}

/** Fetches a decision page from an allowed host, re-checking every redirect. */
export async function fetchDecision(rawUrl: string): Promise<{ url: string; text: string; meta: DecisionMeta }> {
  let check = checkDecisionUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!check.ok) throw new Error(check.reason);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(check.url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "LawAITutor-ReviewerTool/1.0", Accept: "text/html" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("The site redirected without an address.");
      check = checkDecisionUrl(new URL(location, check.url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The site answered ${res.status}. Check the link.`);
    const type = res.headers.get("content-type");
    if (type && !/html|text/i.test(type)) {
      throw new Error("That link is not a web page. Use the HTML page of the decision, not the PDF.");
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("That page is too large to be a single decision.");
    const text = htmlToText(decodeHtmlBytes(bytes, type));
    return { url: check.url.toString(), text, meta: extractDecisionMeta(text) };
  }
  throw new Error("Too many redirects.");
}

export interface ReviewerDetails {
  /** e.g. "Soto v. Reyes-Soto" */
  caseTitle?: string;
  /** e.g. "G.R. No. 249759" or just "249759" */
  grNumber?: string;
  /** e.g. "April 22, 2026" */
  date?: string;
}

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\r\n\t"\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/**
 * The reviewer may type the case title, G.R. number and date. What they type wins;
 * anything left blank is read from the decision. Returns problems with what was typed.
 */
export function applyReviewerDetails(
  meta: DecisionMeta,
  details: ReviewerDetails,
): { meta: DecisionMeta & { title: string | null }; problems: string[] } {
  const problems: string[] = [];
  const out = { ...meta, title: null as string | null };

  const title = clean(details.caseTitle, 200);
  if (title) {
    if (!/\sv(?:s)?\.\s/.test(title)) problems.push('Write the case title as "Petitioner v. Respondent", e.g. "Soto v. Reyes-Soto".');
    out.title = title;
  }

  const gr = clean(details.grNumber, 60);
  if (gr) {
    const digits = /^(?:G\.?\s*R\.?\s*Nos?\.?\s*)?([0-9][0-9\s,&\-and]*[0-9]|[0-9])$/i.exec(gr)?.[1];
    if (!digits) problems.push('Write the G.R. number like "G.R. No. 249759".');
    else out.grNumber = `G.R. No. ${digits.replace(/\s+/g, " ")}`;
  }

  const date = clean(details.date, 40);
  if (date) {
    const iso = toISODate(date);
    if (!iso) problems.push('Write the date like "April 22, 2026".');
    else {
      // Written out in full the way the Court writes it, e.g. "April 22, 2026".
      const [y, mo, d] = iso.split("-").map(Number);
      out.date = `${MONTH_NAMES[mo - 1]} ${d}, ${y}`;
      out.dateISO = iso;
    }
  }
  return { meta: out, problems };
}

/** Pasted or uploaded decision text: tidy spacing, keep paragraphs. */
export function tidyDecisionText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
