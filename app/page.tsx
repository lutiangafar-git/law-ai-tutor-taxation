import { Suspense } from "react";
import { LandingClient } from "@/components/LandingClient";

/** Landing page: the student identifies their year or bar status, then goes to /drills. */
export default function LandingPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <LandingClient />
    </Suspense>
  );
}
