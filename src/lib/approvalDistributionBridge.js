import {
  createCEOApprovalBatch,
} from "./ceoApprovalStore.js";

/*
  Converts Auto-Pilot approval items into
  database-ready CEO approval records.
*/
export async function saveCEOApprovalQueue(
  db,
  approvalItems = []
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  if (!Array.isArray(approvalItems)) {
    throw new Error(
      "approvalItems must be an array"
    );
  }

  if (approvalItems.length === 0) {
    return {
      success: true,
      saved: 0,
      items: [],
    };
  }

  const items = approvalItems.map(
    (item) => ({
      articleId:
        item.articleId ||
        item.article_id ||
        null,

      platform:
        item.platform ||
        "website",

      region:
        item.region ||
        "worldwide",

      title:
        item.title ||
        "",

      content:
        item.content ||
        item.caption ||
        "",

      decision:
        item.decision ||
        "ceo_approval",

      riskLevel:
        item.riskLevel ||
        item.risk_level ||
        "medium",

      safetyResult:
        item.safetyResult ||
        item.safety_result ||
        {},

      scheduleData:
        item.scheduleData ||
        item.schedule_data ||
        {},
    })
  );

  const saved =
    await createCEOApprovalBatch(
      db,
      items
    );

  return {
    success: true,
    saved: saved.length,
    items: saved,
  };
}

/*
  Builds a clean CEO approval summary
  for the dashboard.
*/
export function buildCEOApprovalSummary(
  approvalItems = []
) {
  if (!Array.isArray(approvalItems)) {
    return {
      total: 0,
      platforms: {},
      regions: {},
      riskLevels: {},
    };
  }

  const summary = {
    total: approvalItems.length,
    platforms: {},
    regions: {},
    riskLevels: {},
  };

  for (const item of approvalItems) {
    const platform =
      item.platform ||
      "website";

    const region =
      item.region ||
      "worldwide";

    const riskLevel =
      item.riskLevel ||
      item.risk_level ||
      "medium";

    summary.platforms[platform] =
      (summary.platforms[platform] || 0) + 1;

    summary.regions[region] =
      (summary.regions[region] || 0) + 1;

    summary.riskLevels[riskLevel] =
      (summary.riskLevels[riskLevel] || 0) + 1;
  }

  return summary;
}

/*
  Returns the status of this bridge.
*/
export function getApprovalDistributionBridgeStatus() {
  return {
    name:
      "Approval Distribution Bridge",

    status:
      "ready",

    purpose:
      "Connect Auto-Pilot CEO approvals with PostgreSQL",

    supports: [
      "approval queue persistence",
      "platform tracking",
      "regional tracking",
      "risk tracking",
      "dashboard summary",
    ],
  };
}
