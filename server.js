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
  getProductionHealth,
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
import ceoApprovalDashboardRoutes from "./src/routes/ceoApprovalDashboardRoutes.js";
import engagementRoutes from "./src/routes/engagementRoutes.js";
import sitemapRoutes from "./src/routes/sitemapRoutes.js";
import adminAuditRoutes from "./src/routes/adminAuditRoutes.js";
import trendingRoutes from "./src/routes/trendingRoutes.js";
import productionMonitorRoutes from "./src/routes/productionMonitorRoutes.js";

import {
  verifyCronRequest,
} from "./src/lib/cronSecurity.js";

dotenv.config();

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const app =
  express();

const PORT =
  Number(process.env.PORT) || 3000;

const {
  Pool,
} = pg;

const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.DATABASE_URL
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });

app.locals.db =
  pool;

app.locals.automation = {
  run: async () => {
    return runNewsAutomation(
      pool
    );
  },

  scheduledRun: async () => {
    return runScheduledAutomation(
      pool
    );
  },

  status: async () => {
    return getAutomationStatus();
  },

  schedulerStatus: async () => {
    return getAutomationSchedulerStatus();
  },
};

app.disable(
  "x-powered-by"
);

app.set(
  "trust proxy",
  1
);

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

app.use(
  securityMiddleware
);

app.use(
  rateLimitMiddleware({
    windowMs:
      60 * 1000,

    maxRequests:
      120,
  })
);

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================
   BASIC HEALTH
========================= */

app.get(
  "/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        success: true,

        status:
          "healthy",

        database:
          "connected",

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Health check error:",
        error.message
      );

      res.status(503).json({
        success: false,

        status:
          "unhealthy",

        database:
          "error",

        error:
          error.message,

        timestamp:
          new Date().toISOString(),
      });
    }
  }
);

/* =========================
   SYSTEM STATUS
========================= */

app.get(
  "/api/system/status",
  (req, res) => {
    try {
      res.json({
        success: true,

        project:
          "ZEESHAN NEWS AI",

        status:
          "operational",

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
          "Unable to load system status",
      });
    }
  }
);

/* =========================
   PUBLIC NEWS
========================= */

app.use(
  "/api/news",
  newsRoutes
);

app.use(
  "/api/trending",
  trendingRoutes
);

app.use(
  "/api/push",
  pushRoutes
);

/* =========================
   ADMIN ROUTES
========================= */

app.use(
  "/api/push/admin",
  adminAuthMiddleware,
  pushAdminRoutes
);

app.use(
  "/api/dashboard",
  adminAuthMiddleware,
  dashboardRoutes
);

app.use(
  "/api/analytics",
  adminAuthMiddleware,
  analyticsRoutes
);

app.use(
  "/api/takedown",
  adminAuthMiddleware,
  takedownRoutes
);

app.use(
  "/api/source-health",
  adminAuthMiddleware,
  sourceHealthRoutes
);

app.use(
  "/api/automation-history",
  adminAuthMiddleware,
  automationHistoryRoutes
);

app.use(
  "/api/source-policy",
  adminAuthMiddleware,
  sourcePolicyRoutes
);

app.use(
  "/api/social-distribution",
  adminAuthMiddleware,
  socialDistributionRoutes
);

app.use(
  "/api/content-distribution",
  adminAuthMiddleware,
  contentDistributionRoutes
);

app.use(
  "/api/autopilot",
  adminAuthMiddleware,
  autoPilotRoutes
);

app.use(
  "/api/ceo-approval",
  adminAuthMiddleware,
  ceoApprovalRoutes
);

app.use(
  "/api/ceo-approval-dashboard",
  adminAuthMiddleware,
  ceoApprovalDashboardRoutes
);

app.use(
  "/api/admin-audit",
  adminAuthMiddleware,
  adminAuditRoutes
);

app.use(
  "/api/production-monitor",
  adminAuthMiddleware,
  productionMonitorRoutes
);

app.use(
  "/api/engagement",
  engagementRoutes
);

/* =========================
   MANUAL AUTOMATION
========================= */

app.post(
  "/api/automation/run",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const result =
        await runNewsAutomation(
          pool
        );

      res.json({
        success:
          result.success !== false,

        result,
      });
    } catch (error) {
      console.error(
        "❌ Automation run error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);

/* =========================
   AUTOMATION STATUS
========================= */

app.get(
  "/api/automation/status",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      res.json({
        success: true,

        automation:
          getAutomationStatus(),

        scheduler:
          getAutomationSchedulerStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Automation status error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          "Unable to load automation status",
      });
    }
  }
);

/* =========================
   VERCEL CRON
   EVERY 30 MINUTES
========================= */

app.get(
  "/api/automation/cron",
  async (req, res) => {
    try {
      const valid =
        verifyCronRequest(
          req
        );

      if (!valid) {
        return res.status(401).json({
          success: false,

          error:
            "Unauthorized cron request",
        });
      }

      const result =
        await runScheduledAutomation(
          pool
        );

      res.json({
        success:
          result.success !== false,

        source:
          "vercel-cron",

        schedule:
          "*/30 * * * *",

        result,

        scheduler:
          getAutomationSchedulerStatus(),

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

        error:
          error.message,
      });
    }
  }
);

/* =========================
   CRON POST
========================= */

app.post(
  "/api/automation/cron",
  async (req, res) => {
    try {
      const valid =
        verifyCronRequest(
          req
        );

      if (!valid) {
        return res.status(401).json({
          success: false,

          error:
            "Unauthorized cron request",
        });
      }

      const result =
        await runScheduledAutomation(
          pool
        );

      res.json({
        success:
          result.success !== false,

        source:
          "cron-post",

        schedule:
          "*/30 * * * *",

        result,

        scheduler:
          getAutomationSchedulerStatus(),

        timestamp:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ POST cron automation error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);

/* =========================
   SITEMAP
========================= */

app.use(
  "/",
  sitemapRoutes
);

/* =========================
   FRONTEND FALLBACK
========================= */

app.get(
  "*",
  (req, res, next) => {
    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================
   404
========================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        "Route not found",

      path:
        req.originalUrl,
    });
  }
);

/* =========================
   GLOBAL ERROR
========================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "❌ Global server error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      success: false,

      error:
        "Internal server error",
    });
  }
);

/* =========================
   SERVER START
========================= */

const server =
  app.listen(
    PORT,
    () => {
      console.log("");

      console.log(
        "======================================"
      );

      console.log(
        "       ZEESHAN NEWS AI SERVER"
      );

      console.log(
        "======================================"
      );

      console.log(
        `🚀 Server running on port ${PORT}`
      );

      console.log(
        `🌐 Environment: ${
          process.env.NODE_ENV ||
          "development"
        }`
      );

      console.log(
        "🛡️ Security middleware: enabled"
      );

      console.log(
        "🚦 Rate limiting: enabled"
      );

      console.log(
        "🔐 Admin authentication: enabled"
      );

      console.log(
        "📋 Admin audit logging: enabled"
      );

      console.log(
        "🧹 Audit retention: enabled"
      );

      console.log(
        "📈 Trending intelligence: enabled"
      );

      console.log(
        "🤖 Trending automation: enabled"
      );

      console.log(
        "📰 News API: enabled"
      );

      console.log(
        "📊 Dashboard API: enabled"
      );

      console.log(
        "🤖 News automation: connected"
      );

      console.log(
        "📡 Engagement API: enabled"
      );

      console.log(
        "🔎 Dynamic sitemap: enabled"
      );

      console.log(
        "⏰ Vercel Cron: every 30 minutes"
      );

      console.log(
        "🏥 Production monitor: enabled"
      );

      console.log(
        "🔄 Source retry system: enabled"
      );

      console.log(
        "🧠 Automation scheduler: enabled"
      );

      console.log(
        "======================================"
      );

      console.log("");
    }
  );

/* =========================
   GRACEFUL SHUTDOWN
========================= */

async function shutdown(
  signal
) {
  console.log(
    `\n⚠️ ${signal} received. Shutting down...`
  );

  server.close(
    async () => {
      try {
        await pool.end();

        console.log(
          "✅ Database connection closed"
        );

        console.log(
          "✅ Server stopped"
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
  );
}

process.on(
  "SIGTERM",
  () =>
    shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () =>
    shutdown("SIGINT")
);

export default app;