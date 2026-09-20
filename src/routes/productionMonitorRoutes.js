import express from "express";

import {
  ensureProductionMonitorTables,
  getFailedSources,
  getProductionHealth,
  getProductionMonitorStatus,
  resolveSourceFailure,
} from "../lib/productionMonitor.js";

const router =
  express.Router();

/* =========================
   STATUS
========================= */

router.get(
  "/status",
  (req, res) => {
    try {
      res.json({
        success: true,

        monitor:
          getProductionMonitorStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Production monitor status error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to load production monitor status",
      });
    }
  }
);

/* =========================
   INITIALIZE
========================= */

router.post(
  "/initialize",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,

          error:
            "Database connection is not available",
        });
      }

      await ensureProductionMonitorTables(
        db
      );

      res.json({
        success: true,

        message:
          "Production monitor initialized",

        monitor:
          getProductionMonitorStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Production monitor initialization error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to initialize production monitor",
      });
    }
  }
);

/* =========================
   SYSTEM HEALTH
========================= */

router.get(
  "/health",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,

          error:
            "Database connection is not available",
        });
      }

      const health =
        await getProductionHealth(
          db
        );

      res.json({
        success: true,

        health,
      });
    } catch (error) {
      console.error(
        "❌ Production health error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to load production health",
      });
    }
  }
);

/* =========================
   FAILED SOURCES
========================= */

router.get(
  "/failed-sources",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,

          error:
            "Database connection is not available",
        });
      }

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

      const sources =
        await getFailedSources(
          db,
          limit
        );

      res.json({
        success: true,

        count:
          sources.length,

        sources,

        generatedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Failed source lookup error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to load failed sources",
      });
    }
  }
);

/* =========================
   RESOLVE SOURCE
========================= */

router.post(
  "/resolve-source",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,

          error:
            "Database connection is not available",
        });
      }

      const source =
        String(
          req.body?.source || ""
        ).trim();

      if (!source) {
        return res.status(400).json({
          success: false,

          error:
            "Source is required",
        });
      }

      const resolved =
        await resolveSourceFailure(
          db,
          source
        );

      res.json({
        success: true,

        source,

        resolvedCount:
          resolved.length,

        resolved,
      });
    } catch (error) {
      console.error(
        "❌ Source resolution error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to resolve source failure",
      });
    }
  }
);

export default router;
