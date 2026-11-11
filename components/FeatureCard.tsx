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
}: {
  feature: Feature;
  topicId: string;
  lead?: boolean;
}) {
  const item = COPY[feature];
  return (
    <Link
      href={item.href(topicId)}
      className={`block rounded-lg border px-4 py-4 transition hover:border-accent ${
        lead
          ? "border-accent bg-accent-soft/50"
          : "border-line bg-white/75"
      }`}
    >
      <span className="font-medium text-ink">{item.title}</span>
      <span className="mt-1 block text-sm text-muted">{item.blurb}</span>
    </Link>
  );
}
