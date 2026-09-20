export async function ensureAdminAuditTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      route TEXT,
      method TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL DEFAULT true,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
    ON admin_audit_log(created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_action
    ON admin_audit_log(action)
  `);
}

function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded)
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export async function recordAdminAudit(
  db,
  req,
  {
    action = "unknown",
    success = true,
    details = {},
  } = {}
) {
  await ensureAdminAuditTable(db);

  const safeDetails =
    details &&
    typeof details === "object"
      ? details
      : {};

  await db.query(
    `
    INSERT INTO admin_audit_log (
      action,
      route,
      method,
      ip_address,
      user_agent,
      success,
      details
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb
    )
    `,
    [
      String(action),
      req.originalUrl || req.path || null,
      req.method || null,
      getClientIp(req),
      req.headers["user-agent"] ||
        "unknown",
      Boolean(success),
      JSON.stringify(safeDetails),
    ]
  );
}

export async function getAdminAuditLogs(
  db,
  limit = 100
) {
  await ensureAdminAuditTable(db);

  const safeLimit = Math.min(
    Math.max(Number(limit) || 100, 1),
    500
  );

  const result = await db.query(
    `
    SELECT
      id,
      action,
      route,
      method,
      ip_address,
      user_agent,
      success,
      details,
      created_at
    FROM admin_audit_log
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

export function getAdminAuditStatus() {
  return {
    enabled: true,
    databasePersistence: true,
    maxReadLimit: 500,
    records: [
      "action",
      "route",
      "method",
      "ipAddress",
      "userAgent",
      "success",
      "details",
      "timestamp",
    ],
  };
}
