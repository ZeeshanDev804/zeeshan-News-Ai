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
import socialDistributionRoutes from "./src/routes/socialDistributionRoutes.js";

import {
  runRssEngine,
} from "./src/lib/rssEngine.js";

import {
  runNewsAutomation,
} from "./src/lib/newsAutomation.js";

import {
  verifyCronRequest,
} from "./src/lib/cronSecurity.js";

import {
  startScheduler,
  getSchedulerStatus,
  stopScheduler,
} from "./src/lib/scheduler.js";

import {
  getSourceHealthStatus,
} from "./src/lib/sourceHealth.js";

import {
  getAutomationHistory,
} from "./src/lib/automationHistory.js";

import {
  getSystemStatus,
} from "./index.js";


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
    process.env.PORT ||
      3000
  );


const {
  Pool,
} = pg;


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


app.locals.db =
  pool;


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
  Basic security headers
*/
app.disable(
  "x-powered-by"
);


app.use(
  (
    req,
    res,
    next
  ) => {
    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "SAMEORIGIN"
    );

    res.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );

    next();
  }
);


/*
  API Routes
*/

app.use(
  "/api/news",
  newsRoutes
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
  "/api/push",
  pushRoutes
);


app.use(
  "/api/push-admin",
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


/*
  Social Distribution
*/
app.use(
  "/api/social-distribution",
  socialDistributionRoutes
);


/*
  Manual RSS Run
*/
app.post(
  "/api/rss/run",
  async (
    req,
    res
  ) => {
    try {
      const report =
        await runRssEngine(
          pool
        );

      res.json({
        success: true,

        report,
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


/*
  Manual Full Automation Run
*/
app.post(
  "/api/automation/run",
  async (
    req,
    res
  ) => {
    try {
      const report =
        await runNewsAutomation(
          pool
        );

      res.json({
        success: true,

        report,
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


/*
  Secure Vercel Cron
*/
app.post(
  "/api/automation/cron",
  async (
    req,
    res
  ) => {
    try {
      const verification =
        verifyCronRequest(
          req
        );


      if (
        !verification.valid
      ) {
        return res.status(
          401
        ).json({
          success: false,

          error:
            verification.reason,
        });
      }


      const report =
        await runNewsAutomation(
          pool
        );


      res.json({
        success: true,

        source:
          "vercel-cron",

        report,
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


/*
  Automation Status
*/
app.get(
  "/api/automation/status",
  async (
    req,
    res
  ) => {
    try {
      const history =
        await getAutomationHistory(
          pool,
          1
        );


      res.json({
        success: true,

        latest:
          history[0] ||
          null,

        generatedAt:
          new Date().toISOString(),
      });

    } catch (error) {
      console.error(
        "❌ Automation status error:",
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


/*
  Scheduler Status
*/
app.get(
  "/api/scheduler/status",
  (
    req,
    res
  ) => {
    res.json({
      success: true,

      scheduler:
        getSchedulerStatus(),
    });
  }
);


/*
  Stop Scheduler
*/
app.post(
  "/api/scheduler/stop",
  (
    req,
    res
  ) => {
    stopScheduler();

    res.json({
      success: true,

      scheduler:
        getSchedulerStatus(),
    });
  }
);


/*
  System Status
*/
app.get(
  "/api/system/status",
  async (
    req,
    res
  ) => {
    try {
      const dbResult =
        await pool.query(
          "SELECT NOW() AS now"
        );


      const sourceHealth =
        await getSourceHealthStatus(
          pool
        );


      res.json({
        success: true,

        system:
          getSystemStatus(),

        database: {
          connected:
            true,

          serverTime:
            dbResult.rows[0]?.now ||
            null,
        },

        modules: {
          news:
            true,

          rss:
            true,

          ai:
            true,

          duplicateChecking:
            true,

          copyrightProtection:
            true,

          takedown:
            true,

          sourceHealth:
            true,

          automationHistory:
            true,

          sourcePolicy:
            true,

          pushNotifications:
            true,

          dashboard:
            true,

          analytics:
            true,

          videoContent:
            true,

          socialDistribution:
            true,

          autoPilot:
            true,
        },

        sourceHealth,

        generatedAt:
          new Date().toISOString(),
      });

    } catch (error) {
      console.error(
        "❌ System status error:",
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


/*
  Unknown API endpoint
*/
app.use(
  "/api",
  (
    req,
    res
  ) => {
    res.status(
      404
    ).json({
      success: false,

      error:
        "API endpoint not found",
    });
  }
);


/*
  Static Website
*/
app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/*
  Website fallback
*/
app.get(
  "*",
  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);


/*
  Global error handler
*/
app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "❌ Server error:",
      error
    );


    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }


    res.status(
      500
    ).json({
      success: false,

      error:
        process.env.NODE_ENV ===
        "production"
          ? "Internal server error"
          : error.message,
    });
  }
);


/*
  Database connection
*/
async function initializeDatabase() {
  try {
    const result =
      await pool.query(
        "SELECT NOW() AS now"
      );


    console.log(
      "✅ PostgreSQL connected:",
      result.rows[0]?.now
    );

  } catch (error) {
    console.error(
      "❌ PostgreSQL connection failed:",
      error.message
    );

    throw error;
  }
}


/*
  Start Server
*/
async function startServer() {
  try {
    await initializeDatabase();


    app.listen(
      PORT,
      () => {
        console.log(
          `🚀 ZEESHAN NEWS AI running on port ${PORT}`
        );

        console.log(
          "📰 News Engine: READY"
        );

        console.log(
          "🤖 AI Engine: READY"
        );

        console.log(
          "⚖️ Copyright Protection: READY"
        );

        console.log(
          "📊 Analytics: READY"
        );

        console.log(
          "📱 Push Notifications: READY"
        );

        console.log(
          "🎬 Video Content Engine: READY"
        );

        console.log(
          "📡 Social Distribution: READY"
        );

        console.log(
          "🧠 Auto-Pilot Foundation: READY"
        );

        console.log(
          "👔 CEO Command Center: READY"
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

    process.exit(
      1
    );
  }
}


startServer();


export default app;