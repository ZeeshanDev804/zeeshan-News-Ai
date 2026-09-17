// ========================================
// ZEESHAN NEWS AI — MAIN SERVER
// ========================================

import express from "express";
import dotenv from "dotenv";
import pg from "pg";

import {
  runRssEngine,
} from "./src/lib/rssEngine.js";

import newsRoutes from "./src/routes/newsRoutes.js";

import legalRoutes from "./src/routes/legalRoutes.js";

import adminRoutes from "./src/routes/adminRoutes.js";

import {
  runNewsAutomation,
  getAutomationStatus,
} from "./src/lib/newsAutomation.js";

import {
  verifyCronRequest,
} from "./src/lib/cronSecurity.js";

import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
} from "./src/lib/scheduler.js";


// ========================================
// ENVIRONMENT
// ========================================

dotenv.config();


// ========================================
// APP
// ========================================

const app =
  express();

const PORT =
  Number(
    process.env.PORT || 3000
  );


// ========================================
// MIDDLEWARE
// ========================================

app.use(
  express.json({
    limit: "1mb",
  })
);


// ========================================
// STATIC WEBSITE
// ========================================

app.use(
  express.static(
    "public"
  )
);


// ========================================
// DATABASE CONFIGURATION
// ========================================

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured"
  );

  process.exit(1);
}


const {
  Pool,
} = pg;


const pool =
  new Pool({
    connectionString:
      DATABASE_URL,

    ssl: {
      rejectUnauthorized:
        false,
    },

    max: 10,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000,
  });


app.locals.db =
  pool;


// ========================================
// DATABASE ERROR MONITORING
// ========================================

pool.on(
  "error",
  (error) => {
    console.error(
      "❌ Unexpected database pool error:",
      error.message
    );
  }
);


// ========================================
// DATABASE PREPARATION
// ========================================

async function prepareDatabase() {
  console.log(
    "🗄️ Preparing database..."
  );

  await pool.query(
    `
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS content TEXT
    `
  );

  await pool.query(
    `
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS source TEXT
    `
  );

  await pool.query(
    `
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP
    `
  );

  await pool.query(
    `
    UPDATE articles
    SET content = description
    WHERE
      (content IS NULL OR content = '')
      AND description IS NOT NULL
    `
  );

  await pool.query(
    `
    UPDATE articles
    SET published_at = created_at
    WHERE published_at IS NULL
    `
  );

  console.log(
    "✅ Database preparation completed"
  );
}


// ========================================
// HOME
// ========================================

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      "index.html",
      {
        root: "public",
      }
    );
  }
);


// ========================================
// HEALTH CHECK
// ========================================

app.get(
  "/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      return res.json({
        success: true,

        status:
          "healthy",

        database:
          "connected",

        timestamp:
          new Date(),
      });
    } catch (error) {
      console.error(
        "❌ Health check error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        status:
          "unhealthy",

        database:
          "error",

        timestamp:
          new Date(),
      });
    }
  }
);


// ========================================
// DATABASE STATUS
// ========================================

app.get(
  "/api/database",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          "SELECT 1 AS connected"
        );

      return res.json({
        success: true,

        database:
          result.rows.length > 0
            ? "connected"
            : "unknown",

        timestamp:
          new Date(),
      });
    } catch (error) {
      console.error(
        "❌ Database status error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        database:
          "error",

        error:
          error.message,
      });
    }
  }
);


// ========================================
// NEWS API
// ========================================

app.use(
  "/api/news",
  newsRoutes
);


// ========================================
// LEGAL / COPYRIGHT API
// ========================================

app.use(
  "/api/legal",
  legalRoutes
);


// ========================================
// ADMIN / CEO API
// ========================================

app.use(
  "/api/admin",
  adminRoutes
);


// ========================================
// MANUAL RSS ENGINE
// ========================================

app.get(
  "/api/rss/run",
  async (req, res) => {
    try {
      const report =
        await runRssEngine(
          pool
        );

      return res.json({
        success: true,

        report,
      });
    } catch (error) {
      console.error(
        "❌ RSS run error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "RSS engine failed",
      });
    }
  }
);


// ========================================
// MANUAL AUTOMATION
// ========================================

app.get(
  "/api/automation/run",
  async (req, res) => {
    try {
      const report =
        await runNewsAutomation(
          pool
        );

      return res.json({
        success:
          Boolean(
            report?.success
          ),

        report,
      });
    } catch (error) {
      console.error(
        "❌ Automation run error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "News automation failed",
      });
    }
  }
);


// ========================================
// SECURE CRON AUTOMATION
// ========================================

app.get(
  "/api/automation/cron",
  async (req, res) => {
    const verification =
      verifyCronRequest(
        req
      );

    if (
      !verification.valid
    ) {
      console.warn(
        "⚠️ Unauthorized cron request"
      );

      return res.status(401).json({
        success: false,

        error:
          "Unauthorized cron request",
      });
    }

    try {
      const report =
        await runNewsAutomation(
          pool
        );

      return res.json({
        success:
          Boolean(
            report?.success
          ),

        report,
      });
    } catch (error) {
      console.error(
        "❌ Cron automation error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Cron automation failed",
      });
    }
  }
);


// ========================================
// AUTOMATION STATUS
// ========================================

app.get(
  "/api/automation/status",
  (req, res) => {
    try {
      return res.json({
        success: true,

        status:
          getAutomationStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Automation status error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load automation status",
      });
    }
  }
);


// ========================================
// SCHEDULER STATUS
// ========================================

app.get(
  "/api/scheduler/status",
  (req, res) => {
    try {
      return res.json({
        success: true,

        scheduler:
          getSchedulerStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Scheduler status error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to load scheduler status",
      });
    }
  }
);


// ========================================
// STOP SCHEDULER
// ========================================

app.get(
  "/api/scheduler/stop",
  (req, res) => {
    try {
      const result =
        stopScheduler();

      return res.json({
        success: true,

        result,
      });
    } catch (error) {
      console.error(
        "❌ Scheduler stop error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to stop scheduler",
      });
    }
  }
);


// ========================================
// 404
// ========================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        "Route not found",
    });
  }
);


// ========================================
// GRACEFUL SHUTDOWN
// ========================================

async function shutdown(
  signal
) {
  console.log(
    `\n🛑 ${signal} received`
  );

  try {
    stopScheduler();

    await pool.end();

    console.log(
      "✅ Database connection closed"
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
  () => {
    shutdown(
      "SIGTERM"
    );
  }
);


process.on(
  "SIGINT",
  () => {
    shutdown(
      "SIGINT"
    );
  }
);


// ========================================
// START SERVER
// ========================================

async function startServer() {
  try {
    await prepareDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          "================================="
        );

        console.log(
          "🚀 ZEESHAN NEWS AI"
        );

        console.log(
          `🌐 Server running on port ${PORT}`
        );

        console.log(
          "📰 News Engine: Enabled"
        );

        console.log(
          "🤖 AI Engine: Enabled"
        );

        console.log(
          "⚖️ Copyright Protection: Enabled"
        );

        console.log(
          "📋 Legal Review System: Enabled"
        );

        console.log(
          "🔐 Admin Authentication: Enabled"
        );

        console.log(
          "🔐 Cron Security: Enabled"
        );

        console.log(
          "⏰ Scheduler: Starting"
        );

        console.log(
          "================================="
        );

        startScheduler(
          pool
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


startServer();