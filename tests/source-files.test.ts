import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadAllReviewedTopics } from "@/lib/sources";

/**
 * Checks the real files in /sources/ so a broken or incomplete topic file
 * fails CI before it reaches students. It checks structure only; legal accuracy
 * is checked by a law-trained reviewer (spec criterion 22).
 */
const SOURCES_DIR = path.join(process.cwd(), "sources");
const topicFiles = fs
  .readdirSync(SOURCES_DIR)
  .filter((name) => name.endsWith(".md") && !name.startsWith("_"));

describe("topic files in /sources", () => {
  const topics = loadAllReviewedTopics();

  it("every topic file is either reviewed or marked demo, so none is silently hidden", () => {
    expect(topics.length).toBe(topicFiles.length);
  });

  it("topic ids are unique", () => {
    const ids = topics.map((t) => t.topicId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(topics.map((t) => [t.topicId, t] as const))(
    "%s has every section the tutor needs",
    (_id, topic) => {
      expect(topic.title).not.toBe("");
      expect(topic.subject).not.toBe("");
      expect(topic.yearLevels.length).toBeGreaterThan(0);
      expect(topic.citation).not.toBe("");
      expect(topic.link).toMatch(/^https:\/\//);
      expect(topic.sourceText.length).toBeGreaterThan(20);
      expect(topic.keyPoints.length).toBeGreaterThanOrEqual(2);
      expect(topic.recitationScenario).not.toBe("");
      expect(topic.recitationModelAnswer).not.toBe("");
      expect(topic.problem).not.toBe("");
      expect(topic.modelAnswer.answer).not.toBe("");
      expect(topic.modelAnswer.legalBasis).not.toBe("");
      expect(topic.modelAnswer.application).not.toBe("");
      expect(topic.modelAnswer.conclusion).not.toBe("");
    },
  );

  it("bar reviewees and Year 4 can reach every topic", () => {
    for (const topic of topics) {
      expect(topic.yearLevels).toContain("bar");
      expect(topic.yearLevels).toContain("year-4");
    }
  });
});
