"use client";

import { CLASS_TIME_PAUSE_MESSAGE } from "@/lib/access";

export function ClassPauseBanner() {
  return (
    <div
      className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-5 text-ink"
      role="status"
    >
      <h2 className="font-display text-xl">Paused</h2>
      <p className="mt-2 text-base leading-relaxed">{CLASS_TIME_PAUSE_MESSAGE}</p>
    </div>
  );
}
