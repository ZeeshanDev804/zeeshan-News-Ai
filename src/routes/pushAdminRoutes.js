import express from "express";

import {
  sendPushNotification,
  sendBreakingNewsNotification,
  sendTrendingNewsNotification,
} from "../lib/pushSender.js";

const router = express.Router();

router.post(
  "/send",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const {
        title,
        body,
        url,
        type,
      } = req.body || {};

      const notificationType =
        String(
          type || "general"
        )
          .trim()
          .toLowerCase();

      let report;

      if (
        notificationType ===
        "breaking"
      ) {
        report =
          await sendBreakingNewsNotification(
            db,
            title,
            body,
            url || "/"
          );

      } else if (
        notificationType ===
        "trending"
      ) {
        report =
          await sendTrendingNewsNotification(
            db,
            title,
            body,
            url || "/"
          );

      } else {
        report =
          await sendPushNotification(
            db,
            {
              title,
              body,
              url:
                url || "/",
            },
            "general"
          );
      }

      res.json({
        success: true,
        report,
      });

    } catch (error) {
      console.error(
        "❌ Push send error:",
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
