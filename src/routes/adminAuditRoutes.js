import express from "express";

import {
  getAdminAuditLogs,
  getAdminAuditStatus,
} from "../lib/adminAuditLog.js";

import {
  cleanupAdminAuditLogs,
  getAdminAuditRetentionStatus,
} from "../lib/adminAuditRetention.js";

const router =
  express.Router();

/* =========================
   AUDIT STATUS
========================= */

router.get(
  "/status",
  (req, res) => {
    try {
      res.json({
        success: true,

        audit:
          getAdminAuditStatus(),

        retention:
          getAdminAuditRetentionStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Admin audit status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to read audit status",
      });
    }
  }
);

/* =========================
   AUDIT LOGS
========================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 100,
            1
          ),
          500
        );

      const logs =
        await getAdminAuditLogs(
          db,
          limit
        );

      res.json({
        success: true,

        count:
          logs.length,

        logs,
      });
    } catch (error) {
      console.error(
        "❌ Admin audit logs error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load admin audit logs",
      });
    }
  }
);

/* =========================
   AUDIT CLEANUP
========================= */

router.post(
  "/cleanup",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await cleanupAdminAuditLogs(
          db
        );

      res.json({
        success: true,

        message:
          "Admin audit cleanup completed",

        ...result,
      });
    } catch (error) {
      console.error(
        "❌ Admin audit cleanup error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to cleanup admin audit logs",
      });
    }
  }
);

export default router;