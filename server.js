import express from "express";
import dotenv from "dotenv";
import pg from "pg";

import {
  runRssEngine,
} from "./src/lib/rssEngine.js";

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


dotenv.config();

const { Pool } = pg;

const app = express();

const PORT =
  process.env.PORT || 3000;


// =============================
// MIDDLEWARE
// =============================

app.use(
  express.json()
);


// =============================
// STATIC WEBSITE
// =============================

app.use(
  express.static("public")
);


// =============================
// DATABASE
// =============================

if (
  !process.env.DATABASE_URL
) {
  console.error(
    "❌ DATABASE_URL is missing"
  );

  process.exit(1);
}


const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl: {
      rejectUnauthorized: false,
    },
  });


app.locals.db =
  pool;


pool.on(
  "error",
  (error) => {

    console.error(
      "❌ Unexpected database error:",
      error.message
    );

  }
);


// =============================
// DATABASE PREPARATION
// =============================

async function prepareDatabase() {

  console.log(
    "🗄️ Checking articles table..."
  );


  await pool.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS content TEXT
  `);


  await pool.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS source TEXT
  `);


  await pool.query(`
    ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP
  `);


  await pool.query(`
    UPDATE articles
    SET content = description
    WHERE content IS NULL
      AND description IS NOT NULL
  `);


  await pool.query(`
    UPDATE articles
    SET published_at = created_at
    WHERE published_at IS NULL
      AND created_at IS NOT NULL
  `);


  console.log(
    "✅ Articles table is ready"
  );
}


// =============================
// HOME
// =============================

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


// =============================
// HEALTH CHECK
// =============================

app.get(
  "/health",
  async (req, res) => {

    try {

      await pool.query(
        "SELECT 1"
      );


      res.json({

        success: true,

        server:
          "online",

        database:
          "connected",

        rssEngine:
          "ready",

        newsApi:
          "ready",

        automation:
          "ready",

        scheduler:
          getSchedulerStatus(),

      });

    } catch (error) {

      console.error(
        "❌ Health check failed:",
        error.message
      );


      res.status(500).json({

        success: false,

        server:
          "online",

        database:
          "error",

        rssEngine:
          "unknown",

        newsApi:
          "unknown",

        automation:
          "unknown",

        scheduler:
          "unknown",

        error:
          error.message,

      });

    }
  }
);


// =============================
// DATABASE STATUS
// =============================

app.get(
  "/api/database",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT NOW() AS time"
        );


      res.json({

        success: true,

        database:
          "connected",

        serverTime:
          result.rows[0].time,

      });

    } catch (error) {

      console.error(
        "❌ Database check failed:",
        error.message
      );


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


// =============================
// NEWS API ROUTES
// =============================

app.use(
  "/api/news",
  newsRoutes
);


// =============================
// RSS ENGINE
// =============================

app.get(
  "/api/rss/run",
  async (req, res) => {

    try {

      console.log(
        "🚀 RSS Engine request received"
      );


      const report =
        await runRssEngine(
          pool
        );


      res.json({

        success: true,

        message:
          "RSS Engine completed",

        report,

      });

    } catch (error) {

      console.error(
        "❌ RSS Engine failed:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "RSS Engine failed",

        error:
          error.message,

      });

    }
  }
);


// =============================
// FULL NEWS AUTOMATION
// =============================

app.get(
  "/api/automation/run",
  async (req, res) => {

    try {

      console.log(
        "🤖 News automation request received"
      );


      const report =
        await runNewsAutomation(
          pool
        );


      res.json(
        report
      );

    } catch (error) {

      console.error(
        "❌ News automation route failed:",
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


// =============================
// SECURE VERCEL CRON
// =============================

app.get(
  "/api/automation/cron",
  async (req, res) => {

    const auth =
      verifyCronRequest(req);

    if (!auth.valid) {

      return res.status(401).json({
        success: false,
        error:
          "Unauthorized cron request",
      });

    }


    try {

      console.log(
        "⏰ Secure Vercel Cron triggered"
      );


      const report =
        await runNewsAutomation(
          pool
        );


      return res.json(
        report
      );

    } catch (error) {

      console.error(
        "❌ Secure cron failed:",
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


// =============================
// AUTOMATION STATUS
// =============================

app.get(
  "/api/automation/status",
  (req, res) => {

    try {

      const status =
        getAutomationStatus();


      res.json({

        success: true,

        ...status,

      });

    } catch (error) {

      console.error(
        "❌ Automation status failed:",
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


// =============================
// SCHEDULER STATUS
// =============================

app.get(
  "/api/scheduler/status",
  (req, res) => {

    try {

      const status =
        getSchedulerStatus();


      res.json({

        success: true,

        ...status,

      });

    } catch (error) {

      console.error(
        "❌ Scheduler status failed:",
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


// =============================
// SCHEDULER STOP
// =============================

app.get(
  "/api/scheduler/stop",
  (req, res) => {

    try {

      const result =
        stopScheduler();


      res.json({

        success: true,

        ...result,

      });

    } catch (error) {

      console.error(
        "❌ Scheduler stop failed:",
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


// =============================
// 404 HANDLER
// =============================

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


// =============================
// GRACEFUL SHUTDOWN
// =============================

async function shutdown(
  signal
) {

  console.log(
    `🛑 ${signal} received`
  );


  try {

    stopScheduler();

    await pool.end();

    console.log(
      "✅ Server shutdown complete"
    );

    process.exit(0);

  } catch (error) {

    console.error(
      "❌ Shutdown failed:",
      error.message
    );

    process.exit(1);
  }
}


process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);


process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);


// =============================
// START SERVER
// =============================

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
          "🗄️ PostgreSQL: Connected"
        );

        console.log(
          "📰 RSS Engine: Ready"
        );

        console.log(
          "📰 News API: Connected"
        );

        console.log(
          "🤖 AI Database: Ready"
        );

        console.log(
          "⚙️ Automation: Ready"
        );

        console.log(
          "⏰ Scheduler: Starting"
        );

        console.log(
          "🔐 Cron Security: Enabled"
        );

        console.log(
          "🌐 Website: Ready"
        );

        console.log(
          "================================="
        );


        // =================================
        // START AUTOMATIC NEWS SCHEDULER
        // =================================

        try {

          startScheduler(
            pool
          );

          console.log(
            "✅ Automatic scheduler started"
          );

        } catch (error) {

          console.error(
            "❌ Scheduler startup failed:",
            error.message
          );

        }

      }
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