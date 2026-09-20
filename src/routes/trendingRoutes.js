import express from "express";

import {
  rankTrendingArticles,
  getCategoryTrends,
  getTrendingIntelligenceStatus,
} from "../lib/trendingIntelligence.js";

import {
  ensureTrendingTable,
  saveTrendingScore,
  getStoredTrendingArticles,
  getStoredTrendingScore,
  getTrendingStoreStatus,
} from "../lib/trendingStore.js";

const router =
  express.Router();

/* =========================
   STATUS
========================= */

router.get(
  "/status",
  (req, res) => {
    try {
      res.json({
        success: true,

        intelligence:
          getTrendingIntelligenceStatus(),

        store:
          getTrendingStoreStatus(),
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
   STORED TRENDING
========================= */

router.get(
  "/stored",
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

      const trending =
        await getStoredTrendingArticles(
          db,
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
        "❌ Stored trending error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load stored trending articles",
      });
    }
  }
);

/* =========================
   LIVE TRENDING
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
          FROM articles

          WHERE
            COALESCE(
              legal_hold,
              FALSE
            ) = FALSE

          AND
            (
              is_analyzed = TRUE
              OR is_analyzed IS NULL
            )

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
          FROM articles

          WHERE
            COALESCE(
              legal_hold,
              FALSE
            ) = FALSE

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

/* =========================
   INITIALIZE TRENDING STORE
========================= */

router.post(
  "/initialize",
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

      await ensureTrendingTable(
        db
      );

      res.json({
        success: true,

        message:
          "Trending store initialized",

        store:
          getTrendingStoreStatus(),
      });
    } catch (error) {
      console.error(
        "❌ Trending initialization error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to initialize trending store",
      });
    }
  }
);

/* =========================
   SAVE ARTICLE SCORE
========================= */

router.post(
  "/score/:articleId",
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

      const articleId =
        Number(
          req.params.articleId
        );

      if (
        !Number.isInteger(
          articleId
        ) ||
        articleId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid article ID",
        });
      }

      const result =
        await db.query(
          `
          SELECT *
          FROM articles
          WHERE id = $1
          LIMIT 1
          `,
          [articleId]
        );

      const article =
        result.rows[0];

      if (!article) {
        return res.status(404).json({
          success: false,
          error:
            "Article not found",
        });
      }

      const score =
        await saveTrendingScore(
          db,
          article
        );

      res.json({
        success: true,

        score,
      });
    } catch (error) {
      console.error(
        "❌ Trending score error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to save trending score",
      });
    }
  }
);

/* =========================
   GET ARTICLE SCORE
========================= */

router.get(
  "/score/:articleId",
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

      const articleId =
        Number(
          req.params.articleId
        );

      if (
        !Number.isInteger(
          articleId
        ) ||
        articleId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid article ID",
        });
      }

      const score =
        await getStoredTrendingScore(
          db,
          articleId
        );

      if (!score) {
        return res.status(404).json({
          success: false,
          error:
            "Trending score not found",
        });
      }

      res.json({
        success: true,

        score,
      });
    } catch (error) {
      console.error(
        "❌ Trending score lookup error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load trending score",
      });
    }
  }
);

export default router;