import { NextResponse } from "next/server";
import {
  getTopicById,
  getTopicsForGroup,
  parseStudentYear,
  toClientTopicSummary,
} from "@/lib/sources";
import type { UserGroup } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") as UserGroup | null;
  const topicId = searchParams.get("topicId");
  const year = parseStudentYear(searchParams.get("year"));
  const includeProblem = searchParams.get("includeProblem") === "1";
  const includeScenario = searchParams.get("includeScenario") === "1";

  const validGroups: UserGroup[] = ["year-1-2", "year-3-4", "bar-first-time", "bar-repeater"];
  if (!group || !validGroups.includes(group)) {
    return NextResponse.json({ topics: [] });
  }

  if (topicId) {
    const topic = getTopicById(topicId, group, year);
    if (!topic) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      topic: {
        ...toClientTopicSummary(topic),
        ...(includeProblem ? { problem: topic.problem } : {}),
        ...(includeScenario
          ? { recitationScenario: topic.recitationScenario }
          : {}),
      },
    });
  }

  const topics = getTopicsForGroup(group, year).map(toClientTopicSummary);
  return NextResponse.json({ topics });
}
