import { NextResponse } from "next/server";
import { canUseFeature, CLASS_TIME_PAUSE_MESSAGE } from "@/lib/access";
import { checkQuizAnswer, toClientQuizItem } from "@/lib/quiz";
import { getTopicById, parseStudentYear } from "@/lib/sources";
import type { ClassSchedule, UserGroup } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Objective and multiple-choice quiz (Year 1–2 only). No AI call: answers are checked
 * against the topic file. GET lists the questions without answers or hints;
 * POST checks one try and returns the next hint, or the explanation when correct.
 */

function notAllowed() {
  return NextResponse.json(
    { error: "not_allowed", message: "The quiz is for Year 1 and Year 2 students." },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") as UserGroup | null;
  const year = parseStudentYear(searchParams.get("year"));
  const topicId = searchParams.get("topicId") ?? "";
  if (group !== "year-1-2") return notAllowed();

  const topic = getTopicById(topicId, group, year);
  if (!topic || topic.quiz.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    topic: { topicId: topic.topicId, title: topic.title, isDemo: topic.isDemo },
    items: topic.quiz.map(toClientQuizItem),
  });
}

interface Body {
  userGroup?: UserGroup;
  studentYear?: number | null;
  topicId?: string;
  itemIndex?: number;
  answer?: string;
  wrongTriesBefore?: number;
  classSchedule?: ClassSchedule;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { userGroup, topicId = "", itemIndex = -1, answer = "", wrongTriesBefore = 0 } = body;
  if (userGroup !== "year-1-2") return notAllowed();

  if (!canUseFeature(userGroup, "objective-quiz", body.classSchedule ?? { blocks: [] }, new Date())) {
    return NextResponse.json({ error: "class_time", message: CLASS_TIME_PAUSE_MESSAGE }, { status: 403 });
  }

  const topic = getTopicById(topicId, userGroup, parseStudentYear(body.studentYear));
  const item = topic?.quiz[itemIndex];
  if (!topic || !item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const trimmed = String(answer).trim();
  if (!trimmed) {
    return NextResponse.json({ error: "empty", message: "Type or pick an answer first." }, { status: 400 });
  }
  if (trimmed.length > 200) {
    return NextResponse.json({ error: "too_long", message: "Keep it short: 200 characters or fewer." }, { status: 400 });
  }

  return NextResponse.json(checkQuizAnswer(item, trimmed, Number(wrongTriesBefore) || 0));
}
