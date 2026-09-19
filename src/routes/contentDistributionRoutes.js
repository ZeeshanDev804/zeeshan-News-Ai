import express from "express";

import {
  runContentDistributionOrchestrator,
  getOrchestratorStatus,
} from "../lib/contentDistributionOrchestrator.js";

const router = express.Router();

/*
  GET /api/content-distribution/status
  Returns the current Content Distribution Orchestrator status.
*/
router.get("/status", async (req, res) => {
  try {
    const status = getOrchestratorStatus();

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error(
      "❌ Content Distribution status error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  POST /api/content-distribution/run
  Generates distribution packages and Auto-Pilot decisions.
  Does not require database saving.
*/
router.post("/run", async (req, res) => {
  try {
    const {
      articleId,
      title,
      summary,
      category,
      source,
      sourceUrl,
      content,
      platforms,
      regions,
      mode,
      timezone,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        error: "title is required",
      });
    }

    const result = await runContentDistributionOrchestrator({
      articleId: articleId || null,
      title,
      summary: summary || "",
      category: category || "general",
      source: source || "",
      sourceUrl: sourceUrl || "",
      content: content || "",
      platforms,
      regions,
      mode,
      timezone,
      saveToDatabase: false,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "❌ Content Distribution run error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  POST /api/content-distribution/run-and-save
  Generates distribution packages, evaluates Auto-Pilot,
  and saves the resulting queue into PostgreSQL.
*/
router.post("/run-and-save", async (req, res) => {
  try {
    const {
      articleId,
      title,
      summary,
      category,
      source,
      sourceUrl,
      content,
      platforms,
      regions,
      mode,
      timezone,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        error: "title is required",
      });
    }

    const result = await runContentDistributionOrchestrator({
      articleId: articleId || null,
      title,
      summary: summary || "",
      category: category || "general",
      source: source || "",
      sourceUrl: sourceUrl || "",
      content: content || "",
      platforms,
      regions,
      mode,
      timezone,
      saveToDatabase: true,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "❌ Content Distribution run-and-save error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
