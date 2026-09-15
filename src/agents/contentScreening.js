import { createDuplicateCheck } from "./duplicateAgent.js";
import { createRiskAssessment } from "./riskAgent.js";

export function screenNewsItem({
  item,
  existingArticles = [],
  sourceReliability = 50
}) {
  if (!item?.title) {
    throw new Error("News item is required.");
  }

  const duplicate = createDuplicateCheck({
    title: item.title,
    existingArticles
  });

  const risk = createRiskAssessment({
    contentId: item.url || item.title,
    title: item.title,
    sourceUrl: item.url,
    sourceReliability
  });

  return {
    item,
    duplicate,
    risk,
    allowedToResearch:
      !duplicate.isDuplicate &&
      risk.level === "LOW",
    status:
      duplicate.isDuplicate ||
      risk.level !== "LOW"
        ? "REVIEW"
        : "CLEARED"
  };
}
