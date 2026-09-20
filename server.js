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
import ceoApprovalDashboardRoutes from "./src/routes/ceoApprovalDashboardRoutes.js";
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

          cronSecurity:
            getCronSecurityStatus(),
        },
      });
    } catch (error) {
      console.error(
       