import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

import newsRoutes from "./src/routes/newsRoutes.js";
import takedownRoutes from "./src/routes/takedownRoutes.js";
import sourceHealthRoutes from "./src/routes/sourceHealthRoutes.js";
import automationHistoryRoutes from "./src/routes/automationHistoryRoutes.js";
import sourcePolicyRoutes from "./src/routes/sourcePolicyRoutes.js";
import pushRoutes from "./src/routes/pushRoutes.js";
import pushAdminRoutes from "./src/routes/pushAdminRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";

import {
  runRssEngine,
} from "./src/lib/rssEngine.js";

import {
  runNewsAutomation,
} from "./src/lib/newsAutomation.js";

import {
  startScheduler,
  getSchedulerStatus,
} from "./src/lib/scheduler.js";

import {
  verifyCronRequest,
  isCronConfigured,
} from "./src/lib/cronSecurity.js";

import {
  isPushConfigured,
} from "./src/lib/pushConfig.js";

const {
  Pool,
} = pg;


const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );


const app =
  express();


const PORT =
  Number(
    process.env.PORT || 3000
  );


if (
  !process.env.DATABASE_URL
) {
  console.error(
    "❌ DATABASE_URL is not configured."
  );

  process.exit(1);
}


const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

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


/* -------------------------
   BODY PARSING
------------------------- */

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);


/* -------------------------
   STATIC WEBSITE
------------------------- */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* -------------------------
   HEALTH CHECK
------------------------- */

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

      res.status(500).json({
        success: false,

        status:
          "unhealthy",

        database:
          "error",

        error:
          error.message,
      });
    }
  }
);


/* -------------------------
   NEWS
------------------------- */

app.use(
  "/api/news",
  newsRoutes
);


/* -------------------------
   COPYRIGHT / TAKEDOWN
------------------------- */

app.use(
  "/api/takedown",
  takedownRoutes
);


/* -------------------------
   SOURCE HEALTH
------------------------- */

app.use(
  "/api/source-health",
  sourceHealthRoutes
);


/* -------------------------
   AUTOMATION HISTORY
------------------------- */

app.use(
  "/api/automation-history",
  automationHistoryRoutes
);


/* -------------------------
   SOURCE POLICY
------------------------- */

app.use(
  "/api/source-policy",
  sourcePolicyRoutes
);


/* -------------------------
   WEB PUSH
------------------------- */

app.use(
  "/api/push",
  pushRoutes
);


/* -------------------------
   PUSH ADMIN
------------------------- */

app.use(
  "/api/push-admin",
  pushAdminRoutes
);


/* -------------------------
   CEO DASHBOARD
------------------------- */

app.use(
  "/api/dashboard",
  dashboardRoutes
);


/* -------------------------
   ANALYTICS
------------------------- */

app.use(
  "/api/analytics",
  analyticsRoutes
);


/* -------------------------
   MANUAL RSS RUN
------------------------- */

app.post(
  "/api/rss/run",
  async (req, res) => {

    try {

      const result =
        await runRssEngine(
          pool
        );

      res.json({
        success: true,
        result,
      });

    } catch (error) {

      console.error(
        "❌ RSS run error:",
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


/* -------------------------
   MANUAL AUTOMATION RUN
------------------------- */

app.post(
  "/api/automation/run",
  async (req, res) => {

    try {

      const result =
        await runNewsAutomation(
          pool
        );

      res.json({
        success: true,
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


/* -------------------------
   SECURE VERCEL CRON
------------------------- */

app.get(
  "/api/automation/cron",
  async (req, res) => {

    try {

      const verification =
        verifyCronRequest(
          req
        );


      if (
        !verification.valid
      ) {

        return res.status(401).json({
          success: false,

          error:
            verification.reason,
        });
      }


      const result =
        await runNewsAutomation(
          pool
        );


      res.json({
        success: true,

        source:
          "cron",

        result,
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


/* -------------------------
   AUTOMATION STATUS
------------------------- */

app.get(
  "/api/automation/status",
  (req, res) => {

    res.json({
      success: true,

      enabled:
        true,

      cronConfigured:
        isCronConfigured(),

      timestamp:
        new Date().toISOString(),
    });
  }
);


/* -------------------------
   SCHEDULER STATUS
------------------------- */

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


/* -------------------------
   SCHEDULER STOP
------------------------- */

app.post(
  "/api/scheduler/stop",
  (req, res) => {

    try {

      res.json({
        success: true,

        message:
          "Scheduler stop request received.",
      });

    } catch (error) {

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/* -------------------------
   SYSTEM STATUS
------------------------- */

app.get(
  "/api/system/status",
  (req, res) => {

    res.json({
      success: true,

      system:
        "ZEESHAN NEWS AI",

      database:
        Boolean(
          process.env.DATABASE_URL
        ),

      ai:
        Boolean(
          process.env.AI_API_KEY &&
          process.env.AI_MODEL
        ),

      cron:
        isCronConfigured(),

      push:
        isPushConfigured(),

      analytics:
        true,

      dashboard:
        true,

      copyrightProtection:
        true,

      sourceHealth:
        true,

      automationHistory:
        true,

      sourcePolicy:
        true,

      timestamp:
        new Date().toISOString(),
    });
  }
);


/* -------------------------
   UNKNOWN API ROUTES
------------------------- */

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      success: false,

      error:
        "API endpoint not found.",
    });
  }
);


/* -------------------------
   WEBSITE FALLBACK
------------------------- */

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


/* -------------------------
   START SERVER
------------------------- */

async function startServer() {

  try {

    await pool.query(
      "SELECT 1"
    );


    console.log(
      "✅ Database Connected"
    );


    console.log(
      "🤖 Automation Enabled"
    );


    console.log(
      "⏰ Scheduler Enabled"
    );


    console.log(
      `🔐 Cron Security ${
        isCronConfigured()
          ? "Enabled"
          : "Not Configured"
      }`
    );


    console.log(
      "⚖️ Copyright Protection Enabled"
    );


    console.log(
      "📋 Takedown System Enabled"
    );


    console.log(
      "📡 Source Health Enabled"
    );


    console.log(
      "📊 Automation History Enabled"
    );


    console.log(
      "🛡️ Source Policy Enabled"
    );


    console.log(
      `🔔 Push Notifications ${
        isPushConfigured()
          ? "Enabled"
          : "Not Configured"
      }`
    );


    console.log(
      "👑 CEO Dashboard Enabled"
    );


    console.log(
      "📈 Analytics Enabled"
    );


    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `🚀 ZEESHAN NEWS AI running on port ${PORT}`
        );
      }
    );


    try {

      startScheduler(
        pool
      );

    } catch (error) {

      console.error(
        "❌ Scheduler start error:",
        error.message
      );
    }

  } catch (error) {

    console.error(
      "❌ Database connection failed:",
      error.message
    );

    process.exit(1);
  }
}


startServer();


export default app;