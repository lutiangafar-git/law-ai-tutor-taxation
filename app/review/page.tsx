"use client";

import { useEffect, useRef, useState } from "react";
import { BAR_EXAM } from "@/lib/barExam";
import { SUBJECT } from "@/lib/subject";

type Issue = { level: "error" | "warning"; message: string };
type Meta = {
  title?: string | null;
  grNumber: string | null;
  date: string | null;
  ponente: string | null;
  division: string | null;
  parties: string | null;
};
type Cutoff = { barYear: number | null; inCurrentBar: boolean; note: string };
type Source = "link" | "upload" | "paste";

const PAGE_TITLE = "Reviewer: draft from an SC decision";
const input = "w-full rounded-md border border-line bg-white px-3 py-2";

/**
 * Reviewer-only page.
 * 1. Give the decision: a LawPhil / SC E-Library link, an uploaded PDF, or pasted text.
 * 2. The app drafts a topic and checks it. 3. The reviewer edits it, then approves and publishes
 * (saved to GitHub; live in about two minutes) or downloads the file.
 */
export default function ReviewPage() {
  const [code, setCode] = useState("");
  const [source, setSource] = useState<Source>("link");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [date, setDate] = useState("");
  const [areaHint, setAreaHint] = useState("");
  const [busy, setBusy] = useState<"" | "upload" | "draft" | "check" | "publish">("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cutoff, setCutoff] = useState<Cutoff | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [published, setPublished] = useState<{ path: string; commitUrl: string; dateISO: string } | null>(null);
  const [approvedFallback, setApprovedFallback] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const errors = issues.filter((i) => i.level === "error");
  const details = { caseTitle, grNumber, date };

  useEffect(() => {
    document.title = ready ? `✓ Draft ready · ${PAGE_TITLE}` : PAGE_TITLE;
  }, [ready]);

  async function post(path: string, payload: object) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong."), { data });
    return data;
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy("upload");
    setError("");
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("code", code);
      form.append("file", file);
      const res = await fetch("/api/review/extract", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That file could not be read.");
      setPasted(data.text);
    } catch (err) {
      setError((err as Error).message);
      setPasted("");
    } finally {
      setBusy("");
    }
  }

  async function makeDraft() {
    setBusy("draft");
    setError("");
    setReady(false);
    setIssues([]);
    setMarkdown("");
    setMeta(null);
    setCutoff(null);
    setPublished(null);
    setConfirmed(false);
    setApprovedFallback("");
    try {
      const payload =
        source === "link" ? { code, url, areaHint, details } : { code, text: pasted, areaHint, details };
      const data = await post("/api/review/draft", payload);
      setMarkdown(data.markdown);
      setDecisionText(data.decisionText);
      setIssues(data.issues ?? []);
      setMeta(data.meta);
      setCutoff(data.cutoff);
      setReady(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      const e = err as Error & { data?: { meta?: Meta; cutoff?: Cutoff } };
      setError(e.message);
      if (e.data?.meta) setMeta(e.data.meta);
      if (e.data?.cutoff) setCutoff(e.data.cutoff);
    } finally {
      setBusy("");
    }
  }

  async function recheck() {
    setBusy("check");
    setError("");
    try {
      const data = await post("/api/review/check", { code, markdown, decisionText, details });
      setIssues(data.issues ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    setBusy("publish");
    setError("");
    try {
      const data = await post("/api/review/publish", {
        code,
        markdown,
        decisionText,
        reviewerName,
        confirmed,
        details,
      });
      setPublished({ path: data.path, commitUrl: data.commitUrl, dateISO: data.dateISO });
      setMarkdown(data.approvedMarkdown);
    } catch (err) {
      const e = err as Error & { data?: { issues?: Issue[]; approvedMarkdown?: string } };
      setError(e.message);
      if (e.data?.issues) setIssues(e.data.issues);
      if (e.data?.approvedMarkdown) setApprovedFallback(e.data.approvedMarkdown);
    } finally {
      setBusy("");
    }
  }

  function topicFileName() {
    const id = /^topicId:\s*["']?([\w-]+)/m.exec(markdown)?.[1] ?? "draft-topic";
    return `${id}.md`;
  }

  function download(text: string = markdown) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = topicFileName();
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy did not work in this browser. Use Download instead.");
    }
  }

  const haveDecision = source === "link" ? Boolean(url) : pasted.trim().length > 0;
  const tab = (value: Source, label: string) => (
    <button
      type="button"
      onClick={() => setSource(value)}
      aria-pressed={source === value}
      className={`rounded-md border px-3 py-1.5 text-sm ${
        source === value ? "border-accent bg-accent text-white" : "border-line bg-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="font-display text-2xl">Draft a topic from an SC decision</h1>
        <p className="text-muted">
          For lawyer reviewers only. Give the app a Supreme Court decision. It drafts a {SUBJECT.subjectName}{" "}
          topic (quiz, recitation and a bar-style problem) and checks every quote against the decision. Students
          never see a draft. You check the law, then approve and publish it.
        </p>
        <p className="text-sm text-muted">
          {BAR_EXAM.year} Bar cut-off: decisions promulgated on or before {BAR_EXAM.cutoff}.
        </p>
      </section>

      <section className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Reviewer passcode</span>
          <input type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className={input} />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Where is the decision?</span>
          <div className="flex flex-wrap gap-2">
            {tab("link", "Link")}
            {tab("upload", "Upload PDF")}
            {tab("paste", "Paste text")}
          </div>
          {source === "link" && (
            <input
              type="url"
              aria-label="Link to the decision"
              placeholder="https://lawphil.net/judjuris/juri2026/apr2026/gr_249759_2026.html"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={input}
            />
          )}
          {source === "link" && (
            <p className="text-xs text-muted">LawPhil or SC E-Library. For the SC website, download the PDF and upload it.</p>
          )}
          {source === "upload" && (
            <div className="space-y-1">
              <input
                type="file"
                aria-label="Decision file"
                accept=".pdf,.html,.htm,.txt,application/pdf,text/html,text/plain"
                disabled={!code || busy !== ""}
                onChange={(e) => upload(e.target.files?.[0])}
                className="block text-sm"
              />
              <p className="text-xs text-muted">
                {!code
                  ? "Enter the passcode first."
                  : busy === "upload"
                    ? "Reading the file…"
                    : pasted && fileName
                      ? `Read ${fileName}: ${pasted.length.toLocaleString()} characters.`
                      : "PDF, HTML or text, up to 4 MB. Scanned PDFs may read with errors; the LawPhil link gives cleaner text. If the G.R. number or date cannot be read, type them below."}
              </p>
            </div>
          )}
          {source === "paste" && (
            <textarea
              aria-label="Text of the decision"
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste the full text of the decision, from the G.R. number to the end."
              className={`${input} text-sm`}
            />
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Case details (optional: leave blank to read them from the decision)</legend>
          <input aria-label="Case title" placeholder="Case title, e.g. Soto v. Reyes-Soto" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} className={input} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="G.R. number" placeholder="G.R. No. 249759" value={grNumber} onChange={(e) => setGrNumber(e.target.value)} className={input} />
            <input aria-label="Date of the decision" placeholder="April 22, 2026" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Subject area (optional)</span>
          <select value={areaHint} onChange={(e) => setAreaHint(e.target.value)} className={input}>
            <option value="">Let the app decide</option>
            {SUBJECT.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={makeDraft}
          disabled={!code || !haveDecision || busy !== ""}
          className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-50"
        >
          {busy === "draft" ? "Reading the decision and drafting… (about a minute)" : "Make draft"}
        </button>
        {error && <p className="text-sm text-warn" role="alert">{error}</p>}
      </section>

      {meta && (
        <section className="space-y-1 rounded-md border border-line bg-white/70 px-3 py-3 text-sm">
          <p>
            <strong>Decision:</strong> {meta.title || meta.parties || "parties not read"}
          </p>
          <p>
            <strong>{meta.grNumber ?? "G.R. number not read"}</strong>, {meta.date ?? "date not read"}
            {meta.division ? ` · ${meta.division}` : ""}
            {meta.ponente ? ` · ${meta.ponente}, J.` : ""}
          </p>
          {cutoff && <p className={cutoff.inCurrentBar ? "text-muted" : "text-warn"}>{cutoff.note}</p>}
        </section>
      )}

      {markdown && (
        <section ref={resultRef} className="space-y-4">
          {ready && !published && (
            <p className="rounded-md border border-accent bg-white px-3 py-2 text-sm font-medium text-accent" role="status">
              Your draft is ready. Review it below, then approve and publish it.
            </p>
          )}

          <h2 className="font-display text-xl">Checks</h2>
          {issues.length === 0 ? (
            <p className="text-sm text-accent">
              All checks passed: every quote is word for word in the decision, and every case has its title, G.R.
              number and date. Now check the law itself.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {issues.map((i, n) => (
                <li key={n} className={i.level === "error" ? "text-warn" : "text-muted"}>
                  {i.level === "error" ? "Must fix: " : "Note: "}
                  {i.message}
                </li>
              ))}
            </ul>
          )}

          <h2 className="font-display text-xl">Draft (you can edit it here)</h2>
          <textarea
            aria-label="Draft topic"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            readOnly={Boolean(published)}
            rows={28}
            spellCheck
            className={`${input} font-mono text-sm`}
          />
          <div className="flex flex-wrap gap-3">
            {!published && (
              <button
                type="button"
                onClick={recheck}
                disabled={busy !== ""}
                className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent disabled:opacity-50"
              >
                {busy === "check" ? "Checking…" : "Check again after edits"}
              </button>
            )}
            <button type="button" onClick={() => download()} className="rounded-md border border-line px-4 py-2 text-sm">
              Download {topicFileName()}
            </button>
            <button type="button" onClick={copy} className="rounded-md border border-line px-4 py-2 text-sm">
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>

          {!published ? (
            <div className="space-y-3 rounded-md border border-line bg-white/70 px-4 py-4">
              <h2 className="font-display text-xl">Approve and publish</h2>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Your name as reviewer</span>
                <input
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Atty. Juan Dela Cruz"
                  className={input}
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
                <span>
                  I checked the law, the quotes and the citations against the decision and the Code, and the questions
                  and model answers are correct.
                </span>
              </label>
              <button
                type="button"
                onClick={publish}
                disabled={errors.length > 0 || !confirmed || reviewerName.trim().length < 3 || busy !== ""}
                title={errors.length > 0 ? "Fix the 'Must fix' items first" : ""}
                className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-50"
              >
                {busy === "publish" ? "Publishing…" : "Approve and publish"}
              </button>
              {approvedFallback && (
                <button
                  type="button"
                  onClick={() => download(approvedFallback)}
                  className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent"
                >
                  Download the approved file instead
                </button>
              )}
              <p className="text-xs text-muted">
                Your name and today&apos;s date are written into the topic. It goes live for students in about two
                minutes.
              </p>
            </div>
          ) : (
            <div className="space-y-1 rounded-md border border-accent bg-white px-4 py-4 text-sm" role="status">
              <p className="font-medium text-accent">
                Published. Approved by {reviewerName} on {published.dateISO}.
              </p>
              <p>It will be live for students in about two minutes ({published.path}).</p>
              {published.commitUrl && (
                <a href={published.commitUrl} target="_blank" rel="noreferrer" className="underline">
                  See the saved file on GitHub
                </a>
              )}
            </div>
          )}
          <p className="text-sm text-muted">
            Reminder: teach doctrines from the main opinion only, and write facts fresh. The decision text is public,
            but our questions and model answers must be our own work.
          </p>
        </section>
      )}
    </div>
  );
}
