import express from "express";

import {
  updatePushPreferences,
} from "../lib/pushSubscriptions.js";

const router =
  express.Router();

router.patch(
  "/",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const {
        endpoint,
        preferences,
      } = req.body || {};

      const result =
        await updatePushPreferences(
          db,
          endpoint,
          preferences
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          error:
            "Push subscription not found",
        });
      }

      res.json({
        success: true,
        preferences:
          result,
      });

    } catch (error) {
      console.error(
        "❌ Push preferences error:",
        error.message
      );

      res.status(400).json({
        success: false,
        error:
          error.message,
      });
    }
  }
);

export default router;
