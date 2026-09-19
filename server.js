import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

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
import ceoApprovalRoutes from "./src/routes/ceoApprovalRoutes.js";
import ceoApprovalDashboardRoutes from "./src/routes/ceoApprovalDashboardRoutes.js";
import autoPilotRoutes from "./src/routes/autoPilotRoutes.js";
import engagementRoutes from "./src/routes/engagementRoutes.js";

import { runNewsAutomation } from "./src/lib/newsAutomation.js";

import {
  startScheduler,
  getSchedulerStatus,
} from "./src/lib/scheduler.js";

import {
  verifyCronRequest,
} from "./src/lib/cronSecurity.js";

import {
  getSystemStatus,
} from "./index.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT =
  process.env.PORT || 3000;

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured"
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

app.locals.db = pool;

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.get(
  "/health",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          "SELECT NOW() AS now"
        );

      res.json({
        success: true,
        status: "healthy",
        database: "connected",
        timestamp:
          result.rows[0].now,
      });
    } catch (error) {
      console.error(
        "❌ Health check error:",
        error.message
      );

      res.status(500).json({
        success: false,
        status: "unhealthy",
        database: "error",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/system/status",
  async (req, res) => {
    try {
      const scheduler =
        getSchedulerStatus();

      res.json({
        success: true,

        ...getSystemStatus(),

        features: {
          news: true,
          rss: true,
          ai: true,
          duplicateChecking: true,
          copyrightProtection: true,
          takedown: true,
          sourceHealth: true,
          automationHistory: true,
          sourcePolicy: true,
          pushNotifications: true,
          dashboard: true,
          analytics: true,
          videoContent: true,
          socialDistribution: true,
          contentDistribution: true,
          autoPilot: true,
          autoPilotControl: true,
          ceoApproval: true,
          ceoApprovalDashboard: true,
          engagement: true,
          polls: true,
          voting: true,
          quiz: true,
        },

        scheduler,
      });
    } catch (error) {
      console.error(
        "❌ System status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.use(
  "/api/news",
  newsRoutes
);

app.use(
  "/api/push",
  pushRoutes
);

app.use(
  "/api/push/admin",
  pushAdminRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use(
  "/api/analytics",
  analyticsRoutes
);

app.use(
  "/api/takedown",
  takedownRoutes
);

app.use(
  "/api/source-health",
  sourceHealthRoutes
);

app.use(
  "/api/automation-history",
  automationHistoryRoutes
);

app.use(
  "/api/source-policy",
  sourcePolicyRoutes
);

app.use(
  "/api/social-distribution",
  socialDistributionRoutes
);

app.use(
  "/api/content-distribution",
  contentDistributionRoutes
);

app.use(
  "/api/autopilot",
  autoPilotRoutes
);

app.use(
  "/api/ceo-approval",
  ceoApprovalRoutes
);

app.use(
  "/api/ceo-approval-dashboard",
  ceoApprovalDashboardRoutes
);

app.use(
  "/api/engagement",
  engagementRoutes
);

app.post(
  "/api/automation/run",
  async (req, res) => {
    try {
      const result =
        await runNewsAutomation(pool);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "❌ Manual automation error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/automation/status",
  (req, res) => {
    try {
      res.json({
        success: true,
        scheduler:
          getSchedulerStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Automation status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/automation/cron",
  async (req, res) => {
    try {
      const verification =
        verifyCronRequest(req);

      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          error:
            verification.reason,
        });
      }

      const result =
        await runNewsAutomation(pool);

      return res.json({
        success: true,
        trigger: "vercel_cron",
        ...result,
      });
    } catch (error) {
      console.error(
        "❌ Cron automation error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        "API route not found",
      path: req.originalUrl,
    });
  }
);

app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

app.use(
  (error, req, res, next) => {
    console.error(
      "❌ Global server error:",
      error.message
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      error:
        "Internal server error",
    });
  }
);

async function startServer() {
  try {
    await pool.query(
      "SELECT 1"
    );

    console.log(
      "✅ PostgreSQL connected"
    );

    app.listen(
      PORT,
      () => {
        console.log(
          `🚀 ZEESHAN NEWS AI running on port ${PORT}`
        );
      }
    );

    startScheduler(pool);
  } catch (error) {
    console.error(
      "❌ Failed to start server:",
      error.message
    );

    process.exit(1);
  }
}

startServer();