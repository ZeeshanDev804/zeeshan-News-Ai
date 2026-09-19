import express from "express";

import {
  getDashboardStats,
} from "../lib/dashboardStats.js";

const router =
  express.Router();

router.get(
  "/stats",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const stats =
        await getDashboardStats(
          db
        );

      res.json(stats);
    } catch (error) {
      console.error(
        "❌ Dashboard stats error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load dashboard statistics.",
      });
    }
  }
);

export default router;
