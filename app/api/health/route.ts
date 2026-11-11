import { NextResponse } from "next/server";
import { loadAllReviewedTopics } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for monitoring: is the app up, is the AI key configured, how many topics loaded?
 * Never returns the key itself.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    aiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    topics: loadAllReviewedTopics().length,
    time: new Date().toISOString(),
  });
}
