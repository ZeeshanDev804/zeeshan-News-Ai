import express from "express";

import {
  savePushSubscription,
  disablePushSubscription,
  updatePushPreferences,
} from "../lib/pushSubscriptions.js";

import {
  getVapidPublicKey,
  getPushStatus,
} from "../lib/pushConfig.js";

const router = express.Router();

router.get(
  "/config",
  (req, res) => {
    try {
      const publicKey =
        getVapidPublicKey();

      res.json({
        success: true,
        configured: true,
        publicKey,
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        configured: false,
        error:
          error.message,
      });
    }
  }
);

router.get(
  "/status",
  (req, res) => {
    res.json({
      success: true,
      ...getPushStatus(),
    });
  }
);

router.post(
  "/subscribe",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const {
        subscription,
        preferences,
      } = req.body || {};

      const userAgent =
        req.headers[
          "user-agent"
        ] || "";

      const saved =
        await savePushSubscription(
          db,
          subscription,
          preferences,
          userAgent
        );

      res.status(201).json({
        success: true,
        subscribed: true,
        subscription: saved,
      });

    } catch (error) {
      console.error(
        "❌ Push subscription error:",
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

router.post(
  "/unsubscribe",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const {
        endpoint,
      } = req.body || {};

      const result =
        await disablePushSubscription(
          db,
          endpoint
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
        unsubscribed: true,
        subscription: result,
      });

    } catch (error) {
      console.error(
        "❌ Push unsubscribe error:",
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

router.patch(
  "/preferences",
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
