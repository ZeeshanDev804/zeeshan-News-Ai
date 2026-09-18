import express from "express";

import {
  getSourceHealth,
  getUnhealthySources,
} from "../lib/sourceHealth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const source =
      req.query.source || null;

    const health =
      await getSourceHealth(
        db,
        source
      );

    res.json({
      success: true,
      health,
    });

  } catch (error) {
    console.error(
      "❌ Source health error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get(
  "/unhealthy",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const sources =
        await getUnhealthySources(
          db
        );

      res.json({
        success: true,
        count:
          sources.length,
        sources,
      });

    } catch (error) {
      console.error(
        "❌ Unhealthy sources error:",
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

export default router;
