import express from "express";
import dotenv from "dotenv";
import pg from "pg";

import { runRssEngine } from "./src/lib/rssEngine.js";

import newsRoutes from "./src/routes/newsRoutes.js";
import legalRoutes from "./src/routes/legalRoutes.js";

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


dotenv.config();

const {
  Pool,
} = pg;


const app =
  express();

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

if (
  !process.env.DATABASE_URL
) {
  console.error(
    "❌ DATABASE_URL is not configured"
  );
}


const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.NODE_ENV ===
        "production"
        ? {
            rejectUnauthorized:
              false,
          }
        : {
            rejectUnauthorized:
              false,
          },
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

app.locals.db =
  pool;


// ========================================
// DATABASE PREPARATION
// ========================================

async function prepareDatabase() {
  try {
    await pool.query(
      `
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS content TEXT;
      `
    );

    await pool.query(
      `
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS source TEXT;
      `
    );

    await pool.query(
      `
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
      `
    );


    await pool.query(
      `
      UPDATE articles
      SET content = description
      WHERE
        (content IS NULL OR content = '')
        AND description IS NOT NULL;
      `
    );


    await pool.query(
      `
      UPDATE articles
      SET published_at = created_at
      WHERE published_at IS NULL;
      `
    );


    console.log(
      "✅ Database preparation completed"
    );

  } catch (error) {
    console.error(
      "❌ Database preparation failed:",
      error.message
    );
  }
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

        status:
          "healthy",

        database:
          "connected",

        service:
          "ZEESHAN NEWS AI",
      });

    } catch (error) {
      res.status(503).json({
        success: false,

        status:
          "unhealthy",

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
          "SELECT NOW() AS server_time"
        );

      res.json({
        success: true,

        database:
          "connected",

        serverTime:
          result.rows[0].server_time,
      });

    } catch (error) {
      res.status(500).json({
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
// MANUAL RSS RUN
// ========================================

app.get(
  "/api/rss/run",
  async (req, res) => {
    try {
      const report =
        await runRssEngine(
          pool
        );

      res.json(
        report
      );

    } catch (error) {
      console.error(
        "RSS run error:",
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
// MANUAL NEWS AUTOMATION
// ========================================

app.get(
  "/api/automation/run",
  async (req, res) => {
    try {
      const report =
        await runNewsAutomation(
          pool
        );

      res.json(
        report
      );

    } catch (error) {
      console.error(
        "Automation run error:",
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

    const verification =
      verifyCronRequest(
        req
      );


    if (
      !verification.valid
    ) {
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


    try {
      const report =
        await runNewsAutomation(
          pool
        );

      return res.json(
        report
      );

    } catch (error) {
      console.error(
        "Cron automation error:",
        error.message
      );

      return res.status(500).json({
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

      automation:
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

      scheduler:
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

      ...result,
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
  "SIGINT",
  () => {
    shutdown(
      "SIGINT"
    );
  }
);


process.on(
  "SIGTERM",
  () => {
    shutdown(
      "SIGTERM"
    );
  }
);


// ========================================
// START SERVER
// ========================================

async function startServer() {
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
        "📰 RSS Engine: Enabled"
      );

      console.log(
        "🤖 AI Automation: Enabled"
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
        "📋 Legal Review System: Enabled"
      );

      console.log(
        "================================="
      );
    }
  );


  // --------------------------------------
  // START AUTOMATIC NEWS SCHEDULER
  // --------------------------------------

  startScheduler(
    pool
  );
}


startServer();