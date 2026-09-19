import express from "express";

import {
  getAutoPilotControl,
  setAutoPilotMode,
  activateEmergencyStop,
  releaseEmergencyStop,
  getAutoPilotStoreStatus,
} from "../lib/autoPilotStore.js";

const router = express.Router();

/**
 * GET /api/autopilot/status
 * Auto-Pilot system status
 */
router.get("/status", async (req, res, next) => {
  try {
    const db = req.app.locals.db;

    const status = await getAutoPilotStoreStatus(db);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/autopilot/control
 * Current Auto-Pilot control state
 */
router.get("/control", async (req, res, next) => {
  try {
    const db = req.app.locals.db;

    const control = await getAutoPilotControl(db);

    res.json({
      success: true,
      control,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/autopilot/mode
 * Change Auto-Pilot mode
 *
 * Body:
 * {
 *   "mode": "off" | "assisted" | "auto"
 * }
 */
router.post("/mode", async (req, res, next) => {
  try {
    const db = req.app.locals.db;

    const mode = String(req.body?.mode || "")
      .trim()
      .toLowerCase();

    if (!mode) {
      return res.status(400).json({
        success: false,
        error: "Auto-Pilot mode is required",
      });
    }

    const control = await setAutoPilotMode(db, mode);

    res.json({
      success: true,
      message: `Auto-Pilot mode changed to ${mode}`,
      control,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/autopilot/emergency-stop
 * Immediately stop Auto-Pilot
 *
 * Body:
 * {
 *   "reason": "Optional reason",
 *   "stoppedBy": "CEO"
 * }
 */
router.post("/emergency-stop", async (req, res, next) => {
  try {
    const db = req.app.locals.db;

    const reason =
      String(
        req.body?.reason ||
          "Emergency stop activated by CEO"
      ).trim();

    const stoppedBy =
      String(
        req.body?.stoppedBy || "CEO"
      ).trim();

    const control =
      await activateEmergencyStop(
        db,
        reason,
        stoppedBy
      );

    res.json({
      success: true,
      message:
        "Auto-Pilot emergency stop activated",
      control,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/autopilot/release-stop
 * Release Auto-Pilot emergency stop
 *
 * Body:
 * {
 *   "releasedBy": "CEO"
 * }
 */
router.post("/release-stop", async (req, res, next) => {
  try {
    const db = req.app.locals.db;

    const releasedBy =
      String(
        req.body?.releasedBy || "CEO"
      ).trim();

    const control =
      await releaseEmergencyStop(
        db,
        releasedBy
      );

    res.json({
      success: true,
      message:
        "Auto-Pilot emergency stop released",
      control,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
