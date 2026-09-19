import {
  getCEOApprovalQueue,
  getCEOApprovalById,
  getCEOApprovalStats,
} from "./ceoApprovalStore.js";

/*
  Get the complete CEO approval dashboard data.
*/
export async function getCEOApprovalDashboard(
  db,
  options = {}
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const status =
    options.status || "pending";

  const limit = Math.min(
    Number(options.limit) || 50,
    200
  );

  const [
    queue,
    stats,
  ] = await Promise.all([
    getCEOApprovalQueue(db, {
      status,
      limit,
    }),

    getCEOApprovalStats(db),
  ]);

  const riskSummary = {
    low: 0,
    medium: 0,
    high: 0,
  };

  const platformSummary = {};

  const regionSummary = {};

  for (const item of queue) {
    const riskLevel =
      item.risk_level || "medium";

    if (
      Object.prototype.hasOwnProperty.call(
        riskSummary,
        riskLevel
      )
    ) {
      riskSummary[riskLevel]++;
    }

    const platform =
      item.platform || "website";

    const region =
      item.region || "worldwide";

    platformSummary[platform] =
      (platformSummary[platform] || 0) + 1;

    regionSummary[region] =
      (regionSummary[region] || 0) + 1;
  }

  return {
    success: true,

    queue,

    stats,

    filters: {
      status,
      limit,
    },

    summaries: {
      risk: riskSummary,
      platforms: platformSummary,
      regions: regionSummary,
    },

    generatedAt:
      new Date().toISOString(),
  };
}

/*
  Get one CEO approval item
  with a dashboard-friendly response.
*/
export async function getCEOApprovalDashboardItem(
  db,
  id
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const item =
    await getCEOApprovalById(
      db,
      id
    );

  if (!item) {
    return {
      success: false,
      found: false,
      item: null,
    };
  }

  return {
    success: true,
    found: true,

    item,

    review: {
      canApprove:
        item.status === "pending",

      canReject:
        item.status === "pending",

      canHold:
        item.status === "pending",
    },
  };
}

/*
  Returns counts useful for
  CEO command-center cards.
*/
export async function getCEOApprovalCounters(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const stats =
    await getCEOApprovalStats(db);

  return {
    success: true,

    pending:
      Number(stats.pending || 0),

    approved:
      Number(stats.approved || 0),

    rejected:
      Number(stats.rejected || 0),

    held:
      Number(stats.held || 0),

    total:
      Number(stats.total || 0),
  };
}

/*
  Dashboard module status.
*/
export function getCEOApprovalDashboardStatus() {
  return {
    name:
      "CEO Approval Dashboard",

    status:
      "ready",

    capabilities: [
      "approval queue",
      "approval counters",
      "risk summary",
      "platform summary",
      "regional summary",
      "item review state",
    ],

    humanControl:
      true,

    automaticApproval:
      false,
  };
}
