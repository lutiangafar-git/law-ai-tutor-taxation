import { parseTopicMarkdown } from "./sources";

/**
 * Approve and publish: the reviewer's sign-off is written into the topic file and the file is
 * saved into /sources on GitHub. Vercel redeploys on every change to the main branch, so the
 * topic goes live in about two minutes. Needs GITHUB_TOKEN (fine-grained, "Contents: read and
 * write" on this one repository) and GITHUB_REPO ("owner/name") in Vercel.
 */

export const TOPIC_ID_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;

export function cleanReviewerName(name: unknown): string {
  return String(name ?? "")
    .replace(/[\r\n\t"\\:#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Today's date in the Philippines, yyyy-mm-dd. */
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
}

/** Turns a checked draft into a reviewed topic: sign-off filled, draft status removed. */
export function buildApprovedMarkdown(markdown: string, reviewer: string, dateISO: string): string {
  let md = markdown.replace(/\r\n?/g, "\n");
  const set = (key: string, value: string) => {
    const re = new RegExp(`^${key}:.*$`, "m");
    md = re.test(md) ? md.replace(re, `${key}: ${value}`) : md.replace(/^---\n/, `---\n${key}: ${value}\n`);
  };
  set("reviewedBy", `"${reviewer}"`);
  set("lastReviewed", `"${dateISO}"`);
  md = md.replace(/^status:.*\n/m, "");
  md = md.replace(
    /DRAFT FROM AN SC DECISION\. Hidden from students until a lawyer signs it off\./,
    `Drafted from an SC decision with the reviewer tool; approved by ${reviewer} on ${dateISO}.`,
  );
  return md.endsWith("\n") ? md : `${md}\n`;
}

export function topicIdOf(markdown: string): string {
  return /^topicId:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(markdown)?.[1]?.trim() ?? "";
}

/** Confirms the approved file will show to students as a reviewed (not demo) topic. */
export function approvedFileProblems(markdown: string): string[] {
  const problems: string[] = [];
  const id = topicIdOf(markdown);
  if (!TOPIC_ID_RE.test(id)) problems.push("topicId must be lower-case letters, numbers and hyphens (3 to 80 characters).");
  const topic = parseTopicMarkdown(markdown, id);
  if (!topic) problems.push("The approved file would stay hidden. Check reviewedBy and lastReviewed.");
  else if (topic.isDemo) problems.push("The approved file is still marked demo.");
  return problems;
}

export type PublishResult =
  | { ok: true; path: string; commitUrl: string }
  | { ok: false; status: number; error: string };

export function publishConfig(): { token: string; repo: string; branch: string } | null {
  const token = process.env.GITHUB_TOKEN ?? "";
  const repo = process.env.GITHUB_REPO ?? "";
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { token, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

export async function publishTopicFile(args: {
  topicId: string;
  markdown: string;
  message: string;
  fetchImpl?: typeof fetch;
}): Promise<PublishResult> {
  const cfg = publishConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 503,
      error: "Publishing is not set up. Add GITHUB_TOKEN and GITHUB_REPO in Vercel, or download the file instead.",
    };
  }
  if (!TOPIC_ID_RE.test(args.topicId)) return { ok: false, status: 400, error: "Invalid topicId." };
  const doFetch = args.fetchImpl ?? fetch;
  const path = `sources/${args.topicId}.md`;
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LawAITutor-ReviewerTool",
  };

  const existing = await doFetch(`${url}?ref=${encodeURIComponent(cfg.branch)}`, { headers });
  if (existing.status === 200) {
    return { ok: false, status: 409, error: `A topic named ${args.topicId} already exists. Change the topicId and try again.` };
  }
  if (existing.status !== 404) {
    return { ok: false, status: 502, error: `GitHub answered ${existing.status}. Check the token and repository name.` };
  }

  const res = await doFetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: args.message,
      content: Buffer.from(args.markdown, "utf8").toString("base64"),
      branch: cfg.branch,
    }),
  });
  if (!res.ok) {
    return { ok: false, status: 502, error: `GitHub did not save the file (${res.status}). Check the token's permissions.` };
  }
  const data = (await res.json().catch(() => ({}))) as { commit?: { html_url?: string } };
  return { ok: true, path, commitUrl: data.commit?.html_url ?? "" };
}
