import {
  ensureAdminAuditTable,
} from "./adminAuditLog.js";

import {
  ensureProductionMonitorTables,
} from "./productionMonitor.js";

const DEFAULT_RETENTION_DAYS =
  180;

function getRetentionDays() {
  const configured =
    Number(
      process.env.ADMIN_AUDIT_RETENTION_DAYS
    );

  if (
    Number.isFinite(
      configured
    ) &&
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
   CLEAN ADMIN AUDIT LOGS
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
    await db.query(`
      DELETE FROM admin_audit_log
      WHERE created_at <
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
    `, [
      retentionDays,
    ]);

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
   CLEAN PRODUCTION HEALTH
========================= */

export async function cleanupProductionHealthLogs(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const retentionDays =
    getRetentionDays();

  const result =
    await db.query(`
      DELETE FROM production_health_log
      WHERE checked_at <
        CURRENT_TIMESTAMP -
        ($1 * INTERVAL '1 day')
    `, [
      retentionDays,
    ]);

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
   CLEAN RESOLVED SOURCE FAILURES
========================= */

export async function cleanupResolvedSourceFailures(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  await ensureProductionMonitorTables(
    db
  );

  const retentionDays =
    getRetentionDays();

  const result =
    await db.query(`
      DELETE FROM source_failure_log
      WHERE
        resolved = TRUE
      AND
        resolved_at <
          CURRENT_TIMESTAMP -
          ($1 * INTERVAL '1 day')
    `, [
      retentionDays,
    ]);

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
   COMPLETE LOG CLEANUP
========================= */

export async function cleanupAllOperationalLogs(
  db
) {
  if (!db) {
    throw new Error(
      "Database connection is required"
    );
  }

  const audit =
    await cleanupAdminAuditLogs(
      db
    );

  const health =
    await cleanupProductionHealthLogs(
      db
    );

  const sourceFailures =
    await cleanupResolvedSourceFailures(
      db
    );

  return {
    success:
      audit.success &&
      health.success &&
      sourceFailures.success,

    audit,

    health,

    sourceFailures,

    completedAt:
      new Date().toISOString(),
  };
}

/* =========================
   STATUS
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

    cleanupTargets: [
      "admin_audit_log",
      "production_health_log",
      "resolved_source_failure_log",
    ],

    databaseTables: [
      "admin_audit_log",
      "production_health_log",
      "source_failure_log",
    ],

    environmentVariable:
      "ADMIN_AUDIT_RETENTION_DAYS",
  };
}