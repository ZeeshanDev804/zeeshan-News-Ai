import {
  ensureAdminAuditTable,
} from "./adminAuditLog.js";

/* =========================
   DEFAULT RETENTION
========================= */

const DEFAULT_RETENTION_DAYS =
  180;

/* =========================
   RETENTION DAYS
========================= */

function getRetentionDays() {
  const configured =
    Number(
      process.env.ADMIN_AUDIT_RETENTION_DAYS
    );

  if (
    Number.isFinite(configured) &&
    configured >= 30 &&
    configured <= 3650
  ) {
    return Math.floor(
      configured
    );
  }

  return DEFAULT_RETENTION_DAYS;
}

/* =========================
   CLEANUP
========================= */

export async function cleanupAdminAuditLogs(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureAdminAuditTable(
    db
  );

  const retentionDays =
    getRetentionDays();

  const result =
    await db.query(
      `
      DELETE FROM admin_audit_log
      WHERE created_at <
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
      `,
      [retentionDays]
    );

  return {
    success: true,

    deleted:
      result.rowCount || 0,

    retentionDays,

    timestamp:
      new Date().toISOString(),
  };
}

/* =========================
   RETENTION STATUS
========================= */

export function getAdminAuditRetentionStatus() {
  return {
    enabled: true,

    retentionDays:
      getRetentionDays(),

    minimumAllowedDays:
      30,

    maximumAllowedDays:
      3650,

    automaticCleanup:
      true,

    databaseTable:
      "admin_audit_log",

    environmentVariable:
      "ADMIN_AUDIT_RETENTION_DAYS",
  };
}
