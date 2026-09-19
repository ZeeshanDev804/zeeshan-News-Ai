export async function ensureAutoPilotTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS autopilot_control (
      id INTEGER PRIMARY KEY DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'assisted',
      emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
      stop_reason TEXT,
      stopped_by TEXT,
      stopped_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT autopilot_control_single_row
        CHECK (id = 1)
    )
  `);

  await db.query(`
    INSERT INTO autopilot_control (
      id,
      mode,
      emergency_stop
    )
    VALUES (
      1,
      'assisted',
      FALSE
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

/*
  Get current Auto-Pilot control state.
*/
export async function getAutoPilotControl(db) {
  await ensureAutoPilotTable(db);

  const result = await db.query(`
    SELECT
      id,
      mode,
      emergency_stop,
      stop_reason,
      stopped_by,
      stopped_at,
      updated_at
    FROM autopilot_control
    WHERE id = 1
    LIMIT 1
  `);

  return (
    result.rows[0] || {
      id: 1,
      mode: "assisted",
      emergency_stop: false,
      stop_reason: null,
      stopped_by: null,
      stopped_at: null,
    }
  );
}

/*
  Change Auto-Pilot mode.
*/
export async function setAutoPilotMode(
  db,
  mode
) {
  await ensureAutoPilotTable(db);

  const allowedModes = [
    "off",
    "assisted",
    "auto",
  ];

  if (!allowedModes.includes(mode)) {
    throw new Error(
      `Invalid Auto-Pilot mode: ${mode}`
    );
  }

  const result = await db.query(
    `
    UPDATE autopilot_control
    SET
      mode = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
    `,
    [mode]
  );

  return result.rows[0];
}

/*
  Activate Emergency STOP.
*/
export async function activateEmergencyStop(
  db,
  reason = "Emergency stop activated",
  stoppedBy = "CEO"
) {
  await ensureAutoPilotTable(db);

  const result = await db.query(
    `
    UPDATE autopilot_control
    SET
      emergency_stop = TRUE,
      stop_reason = $1,
      stopped_by = $2,
      stopped_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
    `,
    [reason, stoppedBy]
  );

  return result.rows[0];
}

/*
  Release Emergency STOP.
*/
export async function releaseEmergencyStop(
  db,
  releasedBy = "CEO"
) {
  await ensureAutoPilotTable(db);

  const result = await db.query(
    `
    UPDATE autopilot_control
    SET
      emergency_stop = FALSE,
      stop_reason = NULL,
      stopped_by = $1,
      stopped_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
    `,
    [releasedBy]
  );

  return result.rows[0];
}

/*
  Check whether Auto-Pilot is currently stopped.
*/
export async function isAutoPilotStopped(db) {
  const control =
    await getAutoPilotControl(db);

  return Boolean(
    control.emergency_stop
  );
}

/*
  Get a simple status object for dashboards.
*/
export async function getAutoPilotStoreStatus(
  db
) {
  const control =
    await getAutoPilotControl(db);

  return {
    name: "Auto-Pilot Control Store",
    status: "ready",
    mode: control.mode,
    emergencyStop:
      Boolean(control.emergency_stop),
    stopReason:
      control.stop_reason,
    stoppedBy:
      control.stopped_by,
    stoppedAt:
      control.stopped_at,
  };
}
