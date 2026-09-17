import express from "express";
import {
  getLatestNews,
  getNewsCount,
  searchNews,
} from "../lib/newsService.js";
import {
  analyzeNewsArticle,
  analyzeNewsBatch,
} from "../lib/aiNewsEngine.js";

const router = express.Router();

// =============================
// LATEST NEWS
// =============================

router.get("/", async (req, res) => {
  try {
    const limit = req.query.limit || 50;

    const articles = await getLatestNews(
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
});

// =============================
// NEWS COUNT
// =============================

router.get("/count", async (req, res) => {
  try {
    const total = await getNewsCount(
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
});

// =============================
// NEWS SEARCH
// =============================

router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const limit = req.query.limit || 50;

    if (!String(query).trim()) {
      return res.status(400).json({
        success: false,
        error: "Search query is required",
      });
    }

    const articles = await searchNews(
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
});

// =============================
// AI ANALYZE ONE ARTICLE
// =============================

router.get("/analyze/:id", async (req, res) => {
  try {
    const articleId = Number(req.params.id);

    if (!Number.isInteger(articleId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid article ID",
      });
    }

    const result = await req.app.locals.db.query(
      `
      SELECT
        id,
        title,
        content,
        source,
        link,
        published_at
      FROM articles
      WHERE id = $1
      `,
      [articleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Article not found",
      });
    }

    const analysis = analyzeNewsArticle(
      result.rows[0]
    );

    res.json(analysis);
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
});

// =============================
// AI ANALYZE LATEST NEWS
// =============================

router.get("/analyze", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      20
    );

    const result = await req.app.locals.db.query(
      `
      SELECT
        id,
        title,
        content,
        source,
        link,
        published_at
      FROM articles
      ORDER BY published_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const analyzed = analyzeNewsBatch(
      result.rows
    );

    res.json({
      success: true,
      total: analyzed.length,
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
});

export default router;