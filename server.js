import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

import {
  securityMiddleware,
  securityStatus,
} from "./src/middleware/securityMiddleware.js";

import {
  rateLimitMiddleware,
  getRateLimitStatus,
} from "./src/middleware/rateLimitMiddleware.js";

import {
  adminAuthMiddleware,
  adminAuthStatus,
} from "./src/middleware/adminAuthMiddleware.js";

import {
  getAdminSecurityStatus,
} from "./src/lib/adminSecurity.js";

import {
  getAdminAuditStatus,
} from "./src/lib/adminAuditLog.js";

import {
  getAdminAuditRetentionStatus,
} from "./src/lib/adminAuditRetention.js";

import {
  getTrendingAutomationStatus,
} from "./src/lib/trendingAutomation.js";

import {
  getProductionMonitorStatus,
} from "./src/lib/productionMonitor.js";

import {
  runNewsAutomation,
  getAutomationStatus,
} from "./src/lib/newsAutomation.js";

import {
  runScheduledAutomation,
  getAutomationSchedulerStatus,
} from "./src/lib/automationScheduler.js";

import newsRoutes from "./src/routes/newsRoutes.js";
import pushRoutes from "./src/routes/pushRoutes.js";
import pushAdminRoutes from "./src/routes/pushAdminRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import takedownRoutes from "./src/routes/takedownRoutes.js";
import sourceHealthRoutes from "./src/routes/sourceHealthRoutes.js";
import automationHistoryRoutes from "./src/routes/automationHistoryRoutes.js";
import sourcePolicyRoutes from "./src/routes/sourcePolicyRoutes.js";
import socialDistributionRoutes from "./src/routes/socialDistributionRoutes.js";
import contentDistributionRoutes from "./src/routes/contentDistributionRoutes.js";
import autoPilotRoutes from "./src/routes/autoPilotRoutes.js";
import ceoApprovalRoutes from "./src/routes/ceoApprovalRoutes.js";
import engagementRoutes from "./src/routes/engagementRoutes.js";
import sitemapRoutes from "./src/routes/sitemapRoutes.js";
import adminAuditRoutes from "./src/routes/adminAuditRoutes.js";
import trendingRoutes from "./src/routes/trendingRoutes.js";
import productionMonitorRoutes from "./src/routes/productionMonitorRoutes.js";

import {
  verifyCronRequest,
  getCronSecurityStatus,
} from "./src/lib/cronSecurity.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: process.env.DATABASE_URL
    ? {
        rejectUnauthorized: false,
      }
    : false,

  max: Number(process.env.DB_POOL_MAX) || 10,

  idleTimeoutMillis:
    Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,

  connectionTimeoutMillis:
    Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,
});

app.locals.db = pool;

app.locals.automation = {
  run: async () => {
    return runNewsAutomation(pool);
  },

  scheduledRun: async () => {
    return runScheduledAutomation(pool);
  },

  status: async () => {
    return getAutomationStatus();
  },

  schedulerStatus: async () => {
    return getAutomationSchedulerStatus();
  },
};

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

/*
========================================
SECURITY
========================================
*/

app.use(securityMiddleware);

app.use(
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 120,
  })
);

/*
========================================
STATIC WEBSITE
========================================
*/

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
========================================
BASIC HEALTH
========================================
*/

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "❌ Health check error:",
      error.message
    );

    res.status(503).json({
      success: false,
      status: "unhealthy",
      database: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/*
========================================
ROOT
========================================
*/

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/*
========================================
SYSTEM STATUS
========================================
*/

app.get(
  "/api/system/status",
  (req, res) => {
    try {
      res.json({
        success: true,

        project: "ZEESHAN NEWS AI",

        status: "operational",

        timestamp:
          new Date().toISOString(),

        features: {
          newsEngine: true,
          newsDatabase: true,
          duplicateDetection: true,
          aiEngine: true,
          newsWebsite: true,
          automation: true,
          notifications: true,
          dashboard: true,
          sourceMonitoring: true,
          engagement: true,
          trendingIntelligence: true,
          trendingAutomation: true,
          seo: true,
          legalPages: true,
          security: true,
          securityHeaders: true,
          rateLimiting: true,
          adminAuthentication: true,
          adminAudit: true,
          adminAuditRetention: true,
          productionMonitor: true,
          sourceFailureTracking: true,
          retrySystem: true,
          automationScheduler: true,
          autoPilot: true,
          ceoApproval: true,
          socialDistribution: true,
          contentDistribution: true,
          takedownSystem: true,
          sitemap: true,
        },

        automation:
          getAutomationStatus(),

        scheduler:
          getAutomationSchedulerStatus(),

        trendingAutomation:
          getTrendingAutomationStatus(),

        productionMonitor:
          getProductionMonitorStatus(),

        security: {
          headers:
            securityStatus(),

          rateLimit:
            getRateLimitStatus(),

          adminAuth:
            adminAuthStatus(),

          adminSecurity:
            getAdminSecurityStatus(),

          adminAudit:
            getAdminAuditStatus(),

          adminAuditRetention:
            getAdminAuditRetentionStatus(),

          cronSecurity:
            getCronSecurityStatus(),
        },
      });
    } catch (error) {
      console.error(
        "❌ System status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load system status.",
      });
    }
  }
);

/*
========================================
AUTOMATION STATUS
========================================
*/

app.get(
  "/api/automation/status",
  async (req, res) => {
    try {
      res.json({
        success: true,

        automation:
          getAutomationStatus(),

        scheduler:
          getAutomationSchedulerStatus(),

        trending:
          getTrendingAutomationStatus(),

        productionMonitor:
          getProductionMonitorStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Automation status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load automation status.",
      });
    }
  }
);

/*
========================================
MANUAL NEWS AUTOMATION
========================================

Protected by admin authentication.
*/

app.post(
  "/api/automation/run",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const result =
        await runNewsAutomation(pool);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(
        "❌ News automation error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/*
========================================
SCHEDULED AUTOMATION
========================================
*/

app.post(
  "/api/automation/scheduled",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const result =
        await runScheduledAutomation(
          pool
        );

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(
        "❌ Scheduled automation error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/*
========================================
CRON
========================================
*/

app.post(
  "/api/automation/cron",
  async (req, res) => {
    try {
      const verification =
        verifyCronRequest(req);

      if (!verification?.authorized) {
        return res.status(401).json({
          success: false,
          error:
            "Unauthorized cron request.",
        });
      }

      const result =
        await runScheduledAutomation(
          pool
        );

      res.json({
        success: true,
        type: "cron",
        result,
        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Cron automation error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/*
========================================
NEWS ROUTES
========================================
*/

app.use(
  "/api/news",
  newsRoutes
);

/*
========================================
PUSH ROUTES
========================================
*/

app.use(
  "/api/push",
  pushRoutes
);

app.use(
  "/api/push/admin",
  adminAuthMiddleware,
  pushAdminRoutes
);

/*
========================================
DASHBOARD
========================================
*/

app.use(
  "/api/dashboard",
  adminAuthMiddleware,
  dashboardRoutes
);

/*
========================================
ANALYTICS
========================================
*/

app.use(
  "/api/analytics",
  analyticsRoutes
);

/*
========================================
TAKEDOWN
========================================
*/

app.use(
  "/api/takedown",
  takedownRoutes
);

/*
========================================
SOURCE HEALTH
========================================
*/

app.use(
  "/api/source-health",
  adminAuthMiddleware,
  sourceHealthRoutes
);

/*
========================================
AUTOMATION HISTORY
========================================
*/

app.use(
  "/api/automation-history",
  adminAuthMiddleware,
  automationHistoryRoutes
);

/*
========================================
SOURCE POLICY
========================================
*/

app.use(
  "/api/source-policy",
  adminAuthMiddleware,
  sourcePolicyRoutes
);

/*
========================================
SOCIAL DISTRIBUTION
========================================
*/

app.use(
  "/api/social",
  adminAuthMiddleware,
  socialDistributionRoutes
);

/*
========================================
CONTENT DISTRIBUTION
========================================
*/

app.use(
  "/api/content-distribution",
  adminAuthMiddleware,
  contentDistributionRoutes
);

/*
========================================
AUTO PILOT
========================================
*/

app.use(
  "/api/autopilot",
  adminAuthMiddleware,
  autoPilotRoutes
);

/*
========================================
CEO APPROVAL
========================================
*/

app.use(
  "/api/ceo-approval",
  adminAuthMiddleware,
  ceoApprovalRoutes
);

/*
========================================
ENGAGEMENT
========================================
*/

app.use(
  "/api/engagement",
  engagementRoutes
);

/*
========================================
SITEMAP
========================================
*/

app.use(
  "/sitemap",
  sitemapRoutes
);

/*
========================================
ADMIN AUDIT
========================================
*/

app.use(
  "/api/admin/audit",
  adminAuthMiddleware,
  adminAuditRoutes
);

/*
========================================
TRENDING
========================================
*/

app.use(
  "/api/trending",
  trendingRoutes
);

/*
========================================
PRODUCTION MONITOR
========================================
*/

app.use(
  "/api/production-monitor",
  adminAuthMiddleware,
  productionMonitorRoutes
);

/*
========================================
404 API HANDLER
========================================
*/

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,
      error: "API route not found.",
      path: req.originalUrl,
    });
  }
);

/*
========================================
WEBSITE FALLBACK
========================================
*/

app.use(
  (req, res, next) => {
    if (
      req.method === "GET" &&
      !req.originalUrl.startsWith("/api/")
    ) {
      return res.sendFile(
        path.join(
          __dirname,
          "public",
          "index.html"
        ),
        (error) => {
          if (error) {
            next(error);
          }
        }
      );
    }

    next();
  }
);

/*
========================================
GLOBAL ERROR HANDLER
========================================
*/

app.use(
  (error, req, res, next) => {
    console.error(
      "❌ Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(
      Number(error?.status) || 500
    ).json({
      success: false,

      error:
        process.env.NODE_ENV ===
        "production"
          ? "Internal server error."
          : error.message,

      timestamp:
        new Date().toISOString(),
    });
  }
);

/*
========================================
DATABASE ERROR EVENTS
========================================
*/

pool.on(
  "error",
  (error) => {
    console.error(
      "❌ PostgreSQL pool error:",
      error.message
    );
  }
);

/*
========================================
START SERVER
========================================
*/

let server;

async function startServer() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn(
        "⚠️ DATABASE_URL is not configured."
      );
    } else {
      await pool.query("SELECT 1");

      console.log(
        "✅ Database connection verified."
      );
    }

    server = app.listen(
      PORT,
      () => {
        console.log(
          `🚀 ZEESHAN NEWS AI running on port ${PORT}`
        );

        console.log(
          `🌐 Environment: ${
            process.env.NODE_ENV ||
            "development"
          }`
        );
      }
    );
  } catch (error) {
    console.error(
      "❌ Server startup failed:",
      error.message
    );

    await pool.end();

    process.exit(1);
  }
}

/*
========================================
GRACEFUL SHUTDOWN
========================================
*/

async function shutdown(
  signal
) {
  console.log(
    `\n🛑 ${signal} received. Shutting down...`
  );

  try {
    if (server) {
      await new Promise(
        (resolve) => {
          server.close(
            () => resolve()
          );
        }
      );
    }

    await pool.end();

    console.log(
      "✅ Server shutdown complete."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "❌ Shutdown error:",
      error.message
    );

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "❌ Unhandled promise rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

startServer();

export default app;