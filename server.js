import express from "express";
import dotenv from "dotenv";
import pg from "pg";

import { runRssEngine } from "./src/lib/rssEngine.js";

import newsRoutes from "./src/routes/newsRoutes.js";

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

import takedownRoutes from "./src/routes/takedownRoutes.js";

dotenv.config();

const {
  Pool,
} = pg;

const app = express();

const PORT =
  process.env.PORT || 3000;


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
  express.static("public")
);


// ========================================
// DATABASE CONFIGURATION
// ========================================

if (!process.env.DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not configured"
  );
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 10,

  idleTimeoutMillis:
    30000,

  connectionTimeoutMillis:
    10000,
});


// ========================================
// DATABASE ERROR HANDLER
// ========================================

pool.on(
  "error",
  (error) => {
    console.error(
      "❌ Unexpected PostgreSQL error:",
      error.message
    );
  }
);


// ========================================
// APP DATABASE ACCESS
// ========================================

app.locals.db = pool;


// ========================================
// PREPARE DATABASE
// ========================================

async function prepareDatabase() {
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

      res.json({
        success: true,
        status: "healthy",
        service:
          "ZEESHAN NEWS AI",
        database:
          "connected",
        timestamp:
          new Date().toISOString(),
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        status: "unhealthy",
        database:
          "disconnected",
        error:
          error.message,
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
          "SELECT NOW() AS now"
        );

      res.json({
        success: true,
        connected: true,
        databaseTime:
          result.rows[0].now,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        connected: false,
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
// TAKEDOWN / COPYRIGHT API
// ========================================

app.use(
  "/api/takedown",
  takedownRoutes
);


// ========================================
// MANUAL RSS RUN
// ========================================

app.get(
  "/api/rss/run",
  async (req, res) => {
    try {
      const report =
        await runRssEngine(pool);

      res.json({
        success: true,
        report,
      });

    } catch (error) {
      console.error(
        "❌ RSS run failed:",
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


// ========================================
// MANUAL AUTOMATION RUN
// ========================================

app.get(
  "/api/automation/run",
  async (req, res) => {
    try {
      const report =
        await runNewsAutomation(
          pool
        );

      res.json(report);

    } catch (error) {
      console.error(
        "❌ Automation run failed:",
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


// ========================================
// SECURE VERCEL CRON
// ========================================

app.get(
  "/api/automation/cron",
  async (req, res) => {
    try {
      const verification =
        verifyCronRequest(req);

      if (!verification.valid) {
        console.warn(
          "⚠️ Unauthorized cron request:",
          verification.reason
        );

        return res.status(401).json({
          success: false,
          error:
            "Unauthorized cron request",
        });
      }

      const report =
        await runNewsAutomation(
          pool
        );

      res.json({
        success:
          report?.success ?? false,
        cron: true,
        report,
      });

    } catch (error) {
      console.error(
        "❌ Secure cron failed:",
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


// ========================================
// AUTOMATION STATUS
// ========================================

app.get(
  "/api/automation/status",
  (req, res) => {
    res.json({
      success: true,
      status:
        getAutomationStatus(),
    });
  }
);


// ========================================
// SCHEDULER STATUS
// ========================================

app.get(
  "/api/scheduler/status",
  (req, res) => {
    res.json({
      success: true,
      status:
        getSchedulerStatus(),
    });
  }
);


// ========================================
// STOP SCHEDULER
// ========================================

app.get(
  "/api/scheduler/stop",
  (req, res) => {
    const result =
      stopScheduler();

    res.json({
      success: true,
      result,
    });
  }
);


// ========================================
// 404 HANDLER
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
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
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
          "🚀 ZEESHAN NEWS AI SERVER"
        );

        console.log(
          `🌐 Port: ${PORT}`
        );

        console.log(
          "🗄️ Database: Connected"
        );

        console.log(
          "🤖 Automation: Enabled"
        );

        console.log(
          "⏰ Scheduler: Enabled"
        );

        console.log(
          "🔐 Cron Security: Enabled"
        );

        console.log(
          "⚖️ Copyright Protection: Enabled"
        );

        console.log(
          "🚨 Takedown System: Enabled"
        );

        console.log(
          "================================="
        );
      }
    );

    startScheduler(
      pool
    );

  } catch (error) {
    console.error(
      "❌ Server startup failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();