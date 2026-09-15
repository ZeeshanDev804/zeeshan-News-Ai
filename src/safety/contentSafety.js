const BLOCKED_STATUS = "DO_NOT_PUBLISH";

export function runContentSafetyCheck(article) {
  if (!article || typeof article !== "object") {
    throw new Error("Article data is required.");
  }

  const title = String(article.title || "").trim();
  const body = String(article.body || "").trim();

  const checks = {
    titlePresent: title.length > 0,
    bodyPresent: body.length >= 100,
    sourcePresent: Boolean(article.source?.url),
    originality: article.originality ?? "PENDING",
    duplicate: article.duplicate ?? "PENDING",
    factCheck: article.factCheck ?? "PENDING",
    mediaRights: article.mediaRights ?? "PENDING"
  };

  const automaticFailures = [
    !checks.titlePresent,
    !checks.bodyPresent,
    !checks.sourcePresent,
    checks.originality === "FAIL",
    checks.duplicate === "FAIL",
    checks.factCheck === "FAIL",
    checks.mediaRights === "FAIL"
  ];

  const hasFailure = automaticFailures.some(Boolean);

  return {
    status: hasFailure ? BLOCKED_STATUS : "REVIEW_REQUIRED",
    checks,
    publishAllowed: false,
    message: hasFailure
      ? "Content failed a safety check and must not be published."
      : "Content passed basic checks but requires final verification before publishing."
  };
}
