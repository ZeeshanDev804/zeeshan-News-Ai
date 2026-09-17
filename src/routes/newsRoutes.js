import express from "express";

import {
  getLatestNews,
  getNewsCount,
  searchNews,
  getNewsById,
  getNewsByCategory,
  getCategoryCounts,
  getTrendingNews,
} from "../lib/newsService.js";

import {
  analyzeNewsArticle,
  analyzeNewsBatch,
} from "../lib/aiNewsEngine.js";

const router = express.Router();


// ========================================
// SAVE AI ANALYSIS
// ========================================

async function saveAIAnalysis(
  db,
  analysis
) {
  if (
    !analysis?.success ||
    !analysis?.articleId
  ) {
    return false;
  }

  const isAIAnalyzed =
    analysis.status === "ai_analyzed";

  await db.query(
    `
    UPDATE articles
    SET
      ai_summary = $1,
      ai_category = $2,
      ai_sentiment = $3,
      is_analyzed = $4
    WHERE id = $5
    `,
    [
      analysis.summary || "",
      analysis.category || "world",
      analysis.sentiment || "neutral",
      isAIAnalyzed,
      analysis.articleId,
    ]
  );

  return true;
}


// ========================================
// LATEST NEWS
// ========================================

router.get(
  "/",
  async (req, res) => {
    try {

      const limit =
        req.query.limit || 50;

      const articles =
        await getLatestNews(
          req.app.locals.db,
          limit
        );

      res.json({
        success: true,
        total: articles.length,
        articles,
      });

    } catch (error) {

      console.error(
        "❌ Latest news route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// NEWS COUNT
// ========================================

router.get(
  "/count",
  async (req, res) => {
    try {

      const total =
        await getNewsCount(
          req.app.locals.db
        );

      res.json({
        success: true,
        total,
      });

    } catch (error) {

      console.error(
        "❌ News count route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// NEWS SEARCH
// ========================================

router.get(
  "/search",
  async (req, res) => {
    try {

      const query =
        req.query.q || "";

      const limit =
        req.query.limit || 50;

      if (
        !String(query).trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Search query is required",
        });
      }

      const articles =
        await searchNews(
          req.app.locals.db,
          query,
          limit
        );

      res.json({
        success: true,
        query,
        total: articles.length,
        articles,
      });

    } catch (error) {

      console.error(
        "❌ News search route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// TRENDING NEWS
// ========================================

router.get(
  "/trending",
  async (req, res) => {
    try {

      const limit =
        req.query.limit || 10;

      const articles =
        await getTrendingNews(
          req.app.locals.db,
          limit
        );

      res.json({
        success: true,
        total: articles.length,
        articles,
      });

    } catch (error) {

      console.error(
        "❌ Trending news route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// CATEGORY LIST + COUNTS
// ========================================

router.get(
  "/categories",
  async (req, res) => {
    try {

      const categories =
        await getCategoryCounts(
          req.app.locals.db
        );

      res.json({
        success: true,
        categories,
      });

    } catch (error) {

      console.error(
        "❌ Category counts route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// CATEGORY NEWS
// ========================================

router.get(
  "/category/:category",
  async (req, res) => {
    try {

      const category =
        String(
          req.params.category || ""
        )
          .trim()
          .toLowerCase();

      const allowedCategories = [
        "world",
        "politics",
        "technology",
        "business",
        "sports",
        "entertainment",
      ];

      if (
        !allowedCategories.includes(
          category
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid news category",
          allowedCategories,
        });
      }

      const limit =
        req.query.limit || 50;

      const articles =
        await getNewsByCategory(
          req.app.locals.db,
          category,
          limit
        );

      res.json({
        success: true,
        category,
        total: articles.length,
        articles,
      });

    } catch (error) {

      console.error(
        "❌ Category news route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// SINGLE NEWS ARTICLE
// ========================================

router.get(
  "/article/:id",
  async (req, res) => {
    try {

      const articleId =
        Number(req.params.id);

      if (
        !Number.isInteger(articleId) ||
        articleId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid article ID",
        });
      }

      const article =
        await getNewsById(
          req.app.locals.db,
          articleId
        );

      if (!article) {
        return res.status(404).json({
          success: false,
          error:
            "Article not found",
        });
      }

      res.json({
        success: true,
        article,
      });

    } catch (error) {

      console.error(
        "❌ Single article route failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// AI ANALYZE ONE ARTICLE
// ========================================

router.get(
  "/analyze/:id",
  async (req, res) => {
    try {

      const articleId =
        Number(req.params.id);

      if (
        !Number.isInteger(articleId)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid article ID",
        });
      }

      const result =
        await req.app.locals.db.query(
          `
          SELECT
            id,
            title,
            content,
            description,
            source,
            link,
            published_at
          FROM articles
          WHERE id = $1
          `,
          [articleId]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Article not found",
        });
      }

      const analysis =
        await analyzeNewsArticle(
          result.rows[0]
        );

      const saved =
        await saveAIAnalysis(
          req.app.locals.db,
          analysis
        );

      res.json({
        ...analysis,
        savedToDatabase: saved,
      });

    } catch (error) {

      console.error(
        "❌ AI article analysis failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// AI ANALYZE LATEST NEWS
// ========================================

router.get(
  "/analyze",
  async (req, res) => {
    try {

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 10,
            1
          ),
          20
        );

      const result =
        await req.app.locals.db.query(
          `
          SELECT
            id,
            title,
            content,
            description,
            source,
            link,
            published_at
          FROM articles
          ORDER BY
            published_at DESC NULLS LAST,
            created_at DESC
          LIMIT $1
          `,
          [limit]
        );

      const analyzed =
        await analyzeNewsBatch(
          result.rows
        );

      let savedCount = 0;

      for (
        const analysis
        of analyzed
      ) {

        const saved =
          await saveAIAnalysis(
            req.app.locals.db,
            analysis
          );

        if (saved) {
          savedCount++;
        }
      }

      res.json({
        success: true,
        total: analyzed.length,
        savedToDatabase:
          savedCount,
        articles: analyzed,
      });

    } catch (error) {

      console.error(
        "❌ AI news analysis failed:",
        error.message
      );

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);


export default router;