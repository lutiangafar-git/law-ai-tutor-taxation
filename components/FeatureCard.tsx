import Link from "next/link";
import type { Feature } from "@/lib/types";

const COPY: Record<
  Feature,
  { title: string; blurb: string; href: (topicId: string) => string }
> = {
  "objective-quiz": {
    title: "Objective & multiple-choice quiz",
    blurb: "Year 1–2. Short questions with hints; keep going until you get each one right.",
    href: (id) => `/quiz/${id}`,
  },
  "in-class-quick-check": {
    title: "In-class Quick Check",
    blurb: "1–3 minutes. You answer first; get a citation-backed check.",
    href: (id) => `/quick-check/${id}`,
  },
  "recitation-drill": {
    title: "Recitation drill",
    blurb: "Facts → issue → rule → reasoning → application.",
    href: (id) => `/recitation/${id}`,
  },
  "problem-drill": {
    title: "Problem drill",
    blurb: "ALAC practice score with coaching on your weakest element.",
    href: (id) => `/problem/${id}`,
  },
};

export function FeatureCard({
  feature,
  topicId,
  lead,
  step,
  done,
  locked,
  lockReason,
}: {
  feature: Feature;
  topicId: string;
  lead?: boolean;
  /** Year 1–2: step number within the topic (1 quiz, 2 recitation, 3 problem). */
  step?: number;
  done?: boolean;
  locked?: boolean;
  lockReason?: string;
}) {
  const item = COPY[feature];
  const heading = (
    <span className="font-medium text-ink">
      {step ? `Step ${step}: ` : ""}
      {item.title}
      {done ? " ✓" : ""}
    </span>
  );
  if (locked) {
    return (
      <div
        aria-disabled="true"
        className="block rounded-lg border border-dashed border-line bg-white/40 px-4 py-4 text-muted"
      >
        <span aria-hidden="true">🔒 </span>
        {heading}
        <span className="mt-1 block text-sm">{lockReason}</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href(topicId)}
      className={`block rounded-lg border px-4 py-4 transition hover:border-accent ${
        lead
          ? "border-accent bg-accent-soft/50"
          : "border-line bg-white/75"
      }`}
    >
      {heading}
      <span className="mt-1 block text-sm text-muted">{item.blurb}</span>
    </Link>
  );
}
