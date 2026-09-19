import express from "express";

import {
  getDashboardStats,
} from "../lib/dashboardStats.js";


const router =
  express.Router();


/*
  CEO DASHBOARD
  Main statistics endpoint

  Returns:
  - News overview
  - AI processing
  - Categories
  - Sources
  - Automation history
  - Source health
  - Legal/takedown queue
  - Push notification statistics
  - Analytics intelligence
*/


router.get(
  "/stats",
  async (req, res) => {

    try {

      const db =
        req.app.locals.db;


      if (!db) {
        return res.status(500).json({
          success: false,
          error:
            "Database connection is not available.",
        });
      }


      const stats =
        await getDashboardStats(
          db
        );


      res.json(
        stats
      );


    } catch (error) {

      console.error(
        "❌ Dashboard stats error:",
        error.message
      );


      res.status(500).json({

        success: false,

        error:
          "Unable to load dashboard statistics.",

        details:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : error.message,
      });

    }

  }
);


export default router;