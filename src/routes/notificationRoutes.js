// ========================================
// ZEESHAN NEWS AI — NOTIFICATION ROUTES
// ========================================

import express from "express";

import {
  isWebPushConfigured,
  getPublicVapidKey,
  createNotificationPreferences,
} from "../lib/notificationService.js";

import {
  savePushSubscription,
  removePushSubscription,
  disablePushSubscription,
  updatePushPreferences,
  getPushSubscription,
} from "../lib/pushSubscriptionService.js";


const router =
  express.Router();


// ========================================
// WEB PUSH STATUS
// ========================================

router.get(
  "/status",
  (req, res) => {
    return res.json({
      success: true,

      configured:
        isWebPushConfigured(),

      publicKey:
        getPublicVapidKey(),

      preferences:
        createNotificationPreferences(),
    });
  }
);


// ========================================
// SUBSCRIBE
// ========================================

router.post(
  "/subscribe",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      if (!db) {
        return res.status(500).json({
          success: false,

          error:
            "Database connection is unavailable",
        });
      }

      const {
        subscription,
        preferences,
      } = req.body || {};

      if (!subscription) {
        return res.status(400).json({
          success: false,

          error:
            "Push subscription is required",
        });
      }

      const result =
        await savePushSubscription(
          db,
          subscription,
          preferences || {}
        );

      return res.status(201).json(
        result
      );
    } catch (error) {
      console.error(
        "❌ Push subscribe error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        error:
          error.message ||
          "Failed to subscribe for notifications",
      });
    }
  }
);


// ========================================
// UNSUBSCRIBE
// ========================================

router.post(
  "/unsubscribe",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const endpoint =
        req.body?.endpoint;

      if (!endpoint) {
        return res.status(400).json({
          success: false,

          error:
            "Push endpoint is required",
        });
      }

      const result =
        await removePushSubscription(
          db,
          endpoint
        );

      return res.json(
        result
      );
    } catch (error) {
      console.error(
        "❌ Push unsubscribe error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        error:
          error.message ||
          "Failed to unsubscribe",
      });
    }
  }
);


// ========================================
// DISABLE NOTIFICATIONS
// ========================================

router.post(
  "/disable",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const endpoint =
        req.body?.endpoint;

      if (!endpoint) {
        return res.status(400).json({
          success: false,

          error:
            "Push endpoint is required",
        });
      }

      const result =
        await disablePushSubscription(
          db,
          endpoint
        );

      return res.json(
        result
      );
    } catch (error) {
      console.error(
        "❌ Push disable error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        error:
          error.message ||
          "Failed to disable notifications",
      });
    }
  }
);


// ========================================
// UPDATE PREFERENCES
// ========================================

router.patch(
  "/preferences",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const endpoint =
        req.body?.endpoint;

      const preferences =
        req.body?.preferences ||
        {};

      if (!endpoint) {
        return res.status(400).json({
          success: false,

          error:
            "Push endpoint is required",
        });
      }

      const result =
        await updatePushPreferences(
          db,
          endpoint,
          preferences
        );

      return res.json(
        result
      );
    } catch (error) {
      console.error(
        "❌ Notification preference error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        error:
          error.message ||
          "Failed to update notification preferences",
      });
    }
  }
);


// ========================================
// GET SUBSCRIPTION
// ========================================

router.post(
  "/subscription",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const endpoint =
        req.body?.endpoint;

      if (!endpoint) {
        return res.status(400).json({
          success: false,

          error:
            "Push endpoint is required",
        });
      }

      const subscription =
        await getPushSubscription(
          db,
          endpoint
        );

      return res.json({
        success: true,

        subscription,
      });
    } catch (error) {
      console.error(
        "❌ Push subscription lookup error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        error:
          error.message ||
          "Failed to load subscription",
      });
    }
  }
);


export default router;
