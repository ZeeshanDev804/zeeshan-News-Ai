export async function ensureCEOApprovalTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ceo_approval_queue (
      id SERIAL PRIMARY KEY,
      article_id INTEGER,
      platform TEXT NOT NULL,
      region TEXT,
      title TEXT,
      content TEXT,
      decision TEXT,
      risk_level TEXT,
      safety_result JSONB,
      schedule_data JSONB,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TIMESTAMP,
      rejected_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_ceo_approval_status
    ON ceo_approval_queue(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_ceo_approval_created
    ON ceo_approval_queue(created_at DESC)
  `);
}

export async function createCEOApproval(db, data = {}) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(
    `
    INSERT INTO ceo_approval_queue (
      article_id,
      platform,
      region,
      title,
      content,
      decision,
      risk_level,
      safety_result,
      schedule_data,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      'pending'
    )
    RETURNING *
    `,
    [
      data.articleId || null,
      data.platform || "website",
      data.region || "worldwide",
      data.title || "",
      data.content || "",
      data.decision || "ceo_approval",
      data.riskLevel || "medium",
      JSON.stringify(data.safetyResult || {}),
      JSON.stringify(data.scheduleData || {}),
    ]
  );

  return result.rows[0];
}

export async function createCEOApprovalBatch(
  db,
  items = []
) {
  await ensureCEOApprovalTable(db);

  const created = [];

  for (const item of items) {
    const approval = await createCEOApproval(
      db,
      item
    );

    created.push(approval);
  }

  return created;
}

export async function getCEOApprovalQueue(
  db,
  options = {}
) {
  await ensureCEOApprovalTable(db);

  const status =
    options.status || "pending";

  const limit = Math.min(
    Number(options.limit) || 50,
    200
  );

  const result = await db.query(
    `
    SELECT *
    FROM ceo_approval_queue
    WHERE status = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [status, limit]
  );

  return result.rows;
}

export async function getCEOApprovalById(
  db,
  id
) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(
    `
    SELECT *
    FROM ceo_approval_queue
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function approveCEOItem(
  db,
  id,
  approvedBy = "CEO"
) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(
    `
    UPDATE ceo_approval_queue
    SET
      status = 'approved',
      approved_by = $2,
      approved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [id, approvedBy]
  );

  return result.rows[0] || null;
}

export async function rejectCEOItem(
  db,
  id,
  reason = "Rejected by CEO"
) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(
    `
    UPDATE ceo_approval_queue
    SET
      status = 'rejected',
      rejected_reason = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [id, reason]
  );

  return result.rows[0] || null;
}

export async function holdCEOItem(
  db,
  id,
  reason = "Held for review"
) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(
    `
    UPDATE ceo_approval_queue
    SET
      status = 'held',
      rejected_reason = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [id, reason]
  );

  return result.rows[0] || null;
}

export async function getCEOApprovalStats(db) {
  await ensureCEOApprovalTable(db);

  const result = await db.query(`
    SELECT
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::INTEGER AS pending,
      COUNT(*) FILTER (
        WHERE status = 'approved'
      )::INTEGER AS approved,
      COUNT(*) FILTER (
        WHERE status = 'rejected'
      )::INTEGER AS rejected,
      COUNT(*) FILTER (
        WHERE status = 'held'
      )::INTEGER AS held
    FROM ceo_approval_queue
  `);

  return (
    result.rows[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      held: 0,
    }
  );
}

export function getCEOApprovalStoreStatus() {
  return {
    name: "CEO Approval Store",
    status: "ready",
    databaseTable: "ceo_approval_queue",
    supports: [
      "pending approvals",
      "CEO approval",
      "CEO rejection",
      "hold",
      "approval history",
      "approval statistics",
    ],
  };
}
