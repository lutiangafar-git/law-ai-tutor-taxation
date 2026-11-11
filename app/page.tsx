import { Suspense } from "react";
import { LandingClient } from "@/components/LandingClient";

/** Landing page: the student identifies their year or bar status, then goes to /drills. */
export default function LandingPage() {
  return (
    <Suspense fallback={<p className="landing-green py-10 text-center text-sage">Loading…</p>}>
      <LandingClient />
    </Suspense>
  );
}
