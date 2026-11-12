"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { loadState } from "@/lib/storage";
import { topicSteps } from "@/lib/topicOrder";

type Step = "recitation-drill" | "problem-drill";

const EARLIER: Record<Step, { href: (id: string) => string; label: string }> = {
  "recitation-drill": { href: (id) => `/quiz/${id}`, label: "Go to Step 1: Quiz" },
  "problem-drill": { href: (id) => `/recitation/${id}`, label: "Go to Step 2: Recitation" },
};

/**
 * Year 1–2 go one step at a time within a topic: quiz → recitation → problem.
 * The drills page shows the locks; this guard enforces them when a page is opened
 * directly from a link or bookmark. Year 3–4 and bar reviewees are never locked.
 */
export function StepGuard({ step, children }: { step: Step; children: ReactNode }) {
  const { topicId } = useParams<{ topicId: string }>();
  const [lock, setLock] = useState<{ checked: boolean; reason?: string }>({ checked: false });

  useEffect(() => {
    const state = loadState();
    const s = topicSteps(state.userGroup, topicId, state)[step];
    setLock({ checked: true, reason: s.locked ? s.lockReason : undefined });
  }, [topicId, step]);

  if (!lock.checked) return <p className="text-muted">Loading…</p>;
  if (lock.reason) {
    const earlier = EARLIER[step];
    return (
      <section className="space-y-4 rounded-lg border border-amber-300 bg-amber-50 p-5" role="status">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">🔒 Not yet</p>
        <p className="text-ink">
          Year 1–2 drills go one step at a time: quiz, then recitation, then the bar-style problem.{" "}
          {lock.reason}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={earlier.href(topicId)} className="rounded-md bg-accent px-4 py-2 text-white">
            {earlier.label}
          </Link>
          <Link href="/drills" className="rounded-md border border-line px-4 py-2">
            Back to drills
          </Link>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}
