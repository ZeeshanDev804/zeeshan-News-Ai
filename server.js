import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import { runRssEngine } from "./src/lib/rssEngine.js";
import newsRoutes from "./src/routes/newsRoutes.js";

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// MIDDLEWARE
// =============================

app.use(express.json());

// =============================
// DATABASE
// =============================

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Make database available to routes
app.locals.db = pool;

pool.on("error", (error) => {
  console.error(
    "❌ Unexpected database error:",
    error.message
  );
});

// =============================
// HOME
// =============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "ZEESHAN NEWS AI",
    status: "online",
    version: "1.0.0",
  });
});

// =============================
// HEALTH CHECK
// =============================

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      server: "online",
      database: "connected",
      rssEngine: "ready",
      newsApi: "ready",
    });
  } catch (error) {
    console.error(
      "❌ Health check failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      server: "online",
      database: "error",
      rssEngine: "unknown",
      newsApi: "unknown",
      error: error.message,
    });
  }
});

// =============================
// DATABASE STATUS
// =============================

app.get("/api/database", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS time"
    );

    res.json({
      success: true,
      database: "connected",
      serverTime: result.rows[0].time,
    });
  } catch (error) {
    console.error(
      "❌ Database check failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      database: "error",
      error: error.message,
    });
  }
});

// =============================
// NEWS API ROUTES
// =============================

app.use("/api/news", newsRoutes);

// =============================
// RSS ENGINE
// =============================

app.get("/api/rss/run", async (req, res) => {
  try {
    console.log(
      "🚀 RSS Engine request received"
    );

    const report = await runRssEngine(pool);

    res.json({
      success: true,
      message: "RSS Engine completed",
      report,
    });
  } catch (error) {
    console.error(
      "❌ RSS Engine failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "RSS Engine failed",
      error: error.message,
    });
  }
});

// =============================
// 404 HANDLER
// =============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

// =============================
// START SERVER
// =============================

app.listen(PORT, () => {
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
    "================================="
  );
});