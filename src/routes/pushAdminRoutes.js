import express from "express";

import {
  sendGeneralNews,
  sendBreakingNews,
  sendTrendingNews,
} from "../lib/pushSender.js";

const router = express.Router();

function verifyAdminSecret(req) {
  const secret =
    process.env.CRON_SECRET;

  if (
    !secret ||
    !String(secret).trim()
  ) {
    return false;
  }

  const authorization =
    String(
      req.headers.authorization || ""
    ).trim();

  return (
    authorization ===
    `Bearer ${secret}`
  );
}

router.post(
  "/send",
  async (req, res) => {
    try {
      if (!verifyAdminSecret(req)) {
        return res.status(401).json({
          success: false,
          error:
            "Unauthorized",
        });
      }

      const db =
        req.app.locals.db;

      const {
        type = "general",
        title,
        body,
        url,
        tag,
      } = req.body || {};

      const payload = {
        title,
        body,
        url,
        tag,
      };

      let result;

      if (type === "breaking") {
        result =
          await sendBreakingNews(
            db,
            payload
          );
      } else if (
        type === "trending"
      ) {
        result =
          await sendTrendingNews(
            db,
            payload
          );
      } else {
        result =
          await sendGeneralNews(
            db,
            payload
          );
      }

      res.json(result);
    } catch (error) {
      console.error(
        "❌ Push admin send error:",
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