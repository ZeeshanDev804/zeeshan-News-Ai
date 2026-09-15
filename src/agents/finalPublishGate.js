export function evaluateFinalPublish({
  factCheck,
  originality,
  riskLevel,
  seoReady
}) {
  if (!factCheck || !originality) {
    throw new Error("Verification results are required.");
  }

  const blocked =
    riskLevel === "HIGH" ||
    riskLevel === "CRITICAL";

  if (blocked) {
    return {
      status: "BLOCKED",
      publishAllowed: false,
      reason: "High content risk."
    };
  }

  if (!seoReady) {
    return {
      status: "REVIEW",
      publishAllowed: false,
      reason: "SEO is not ready."
    };
  }

  return {
    status: "READY",
    publishAllowed: true,
    reason: "Passed final checks."
  };
}
