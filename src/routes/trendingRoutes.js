import express from "express";

import {
  rankTrendingArticles,
  getCategoryTrends,
  getTrendingIntelligenceStatus,
} from "../lib/trendingIntelligence.js";

const router =
  express.Router();

/* =========================
   TRENDING STATUS
========================= */

router.get(
  "/status",
  (req, res) => {
    try {
      res.json({
        success: true,
        ...getTrendingIntelligenceStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Trending status error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load trending status",
      });
    }
  }
);

/* =========================
   TRENDING ARTICLES
========================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,
          error:
            "Database connection is not available",
        });
      }

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 20,
            1
          ),
          100
        );

      const result =
        await db.query(`
          SELECT *
          FROM news_articles
          WHERE
            COALESCE(
              status,
              'published'
            ) = 'published'
          ORDER BY
            COALESCE(
              published_at,
              created_at
            ) DESC
          LIMIT 500
        `);

      const articles =
        result.rows || [];

      const trending =
        rankTrendingArticles(
          articles,
          limit
        );

      res.json({
        success: true,

        count:
          trending.length,

        trending,

        generatedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Trending articles error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load trending articles",
      });
    }
  }
);

/* =========================
   CATEGORY TRENDS
========================= */

router.get(
  "/categories",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(503).json({
          success: false,
          error:
            "Database connection is not available",
        });
      }

      const result =
        await db.query(`
          SELECT *
          FROM news_articles
          WHERE
            COALESCE(
              status,
              'published'
            ) = 'published'
          ORDER BY
            COALESCE(
              published_at,
              created_at
            ) DESC
          LIMIT 500
        `);

      const articles =
        result.rows || [];

      const categories =
        getCategoryTrends(
          articles
        );

      res.json({
        success: true,

        count:
          categories.length,

        categories,

        generatedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Category trends error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load category trends",
      });
    }
  }
);

export default router;
