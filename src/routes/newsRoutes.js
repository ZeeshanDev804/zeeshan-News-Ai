import express from "express";
import {
  getLatestNews,
  getNewsCount,
  searchNews,
} from "../lib/newsService.js";

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

export default router;
