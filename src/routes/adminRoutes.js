// ========================================
// ZEESHAN NEWS AI — ADMIN / CEO ROUTES
// ========================================

import express from "express";

import {
  requireAdmin,
} from "../lib/adminAuth.js";

import {
  getNewsCount,
  getLatestNews,
  getTrendingNews,
  getCategoryCounts,
} from "../lib/newsService.js";

import {
  getLegalReviewQueue,
} from "../lib/legalReviewQueue.js";

import {
  getRecentComplaints,
} from "../lib/takedownManager.js";

import {
  getRecentLegalAudit,
} from "../lib/legalAudit.js";

import {
  getSchedulerStatus,
} from "../lib/scheduler.js";

import {
  getKillSwitchStatus,
} from "../lib/emergencyKillSwitch.js";

import {
  isAIConfigured,
} from "../lib/aiProvider.js";

import {
  isCronConfigured,
} from "../lib/cronSecurity.js";

const router =
  express.Router();


// ========================================
// ADMIN DASHBOARD
// ========================================

router.get(
  "/dashboard",
  requireAdmin,
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(500).json({
          success: false,
          error:
            "Database connection is unavailable",
        });
      }

      const [
        newsCount,
        latestNews,
        trendingNews,
        categoryCounts,
        legalQueue,
        complaints,
        audit,
      ] = await Promise.all([
        getNewsCount(db),

        getLatestNews(
          db,
          10
        ),

        getTrendingNews(
          db,
          10
        ),

        getCategoryCounts(
          db
        ),

        getLegalReviewQueue(
          db,
          50
        ),

        getRecentComplaints(
          db,
          50
        ),

        getRecentLegalAudit(
          db,
          50
        ),
      ]);

      const scheduler =
        getSchedulerStatus();

      const killSwitch =
        getKillSwitchStatus();

      const aiConfigured =
        isAIConfigured();

      const cronConfigured =
        isCronConfigured();

      return res.json({
        success: true,

        dashboard: {
          role:
            "Founder & CEO",

          platform:
            "ZEESHAN NEWS AI",

          generatedAt:
            new Date(),
        },

        overview: {
          totalNews:
            Number(
              newsCount?.count ||
                newsCount ||
                0
            ),

          latestNews:
            latestNews || [],

          trendingNews:
            trendingNews || [],

          categoryCounts:
            categoryCounts || [],
        },

        legal: {
          reviewQueue:
            legalQueue || [],

          reviewQueueCount:
            Array.isArray(
              legalQueue
            )
              ? legalQueue.length
              : 0,

          complaints:
            complaints || [],

          complaintCount:
            Array.isArray(
              complaints
            )
              ? complaints.length
              : 0,

          recentAudit:
            audit || [],

          auditCount:
            Array.isArray(
              audit
            )
              ? audit.length
              : 0,
        },

        system: {
          scheduler,

          ai: {
            configured:
              aiConfigured,
          },

          cron: {
            configured:
              cronConfigured,
          },

          emergencyKillSwitch:
            killSwitch,
        },

        security: {
          adminAuth:
            true,

          cronAuth:
            cronConfigured,

          aiProvider:
            aiConfigured,
        },
      });
    } catch (error) {
      console.error(
        "❌ Admin dashboard error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load admin dashboard",
      });
    }
  }
);


// ========================================
// SYSTEM STATUS
// ========================================

router.get(
  "/system-status",
  requireAdmin,
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      let database =
        "unknown";

      if (db) {
        try {
          await db.query(
            "SELECT 1"
          );

          database =
            "connected";
        } catch {
          database =
            "error";
        }
      } else {
        database =
          "unavailable";
      }

      return res.json({
        success: true,

        system: {
          database,

          scheduler:
            getSchedulerStatus(),

          ai: {
            configured:
              isAIConfigured(),
          },

          cron: {
            configured:
              isCronConfigured(),
          },

          emergencyKillSwitch:
            getKillSwitchStatus(),

          adminAuth:
            true,

          checkedAt:
            new Date(),
        },
      });
    } catch (error) {
      console.error(
        "❌ System status error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load system status",
      });
    }
  }
);


// ========================================
// ADMIN NEWS OVERVIEW
// ========================================

router.get(
  "/news",
  requireAdmin,
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 50,
            1
          ),
          100
        );

      const news =
        await getLatestNews(
          db,
          limit
        );

      return res.json({
        success: true,

        count:
          news.length,

        news,
      });
    } catch (error) {
      console.error(
        "❌ Admin news error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load admin news",
      });
    }
  }
);


// ========================================
// ADMIN LEGAL QUEUE
// ========================================

router.get(
  "/legal-queue",
  requireAdmin,
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const queue =
        await getLegalReviewQueue(
          db,
          100
        );

      return res.json({
        success: true,

        count:
          queue.length,

        queue,
      });
    } catch (error) {
      console.error(
        "❌ Admin legal queue error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load legal review queue",
      });
    }
  }
);


// ========================================
// ADMIN AUDIT LOG
// ========================================

router.get(
  "/audit",
  requireAdmin,
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const audit =
        await getRecentLegalAudit(
          db,
          100
        );

      return res.json({
        success: true,

        count:
          audit.length,

        audit,
      });
    } catch (error) {
      console.error(
        "❌ Admin audit error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load audit log",
      });
    }
  }
);


// ========================================
// EXPORT ROUTER
// ========================================

export default router;
