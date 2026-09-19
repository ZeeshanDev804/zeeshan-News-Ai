import express from "express";

import {
  trackAnalyticsEvent,
  getAnalyticsOverview,
  getTopArticles,
  getTopSearches,
  getAnalyticsByDay,
  getAnalyticsByCategory,
} from "../lib/analyticsEngine.js";

const router =
  express.Router();


function getClientIP(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(
      forwarded
    )
      .split(",")[0]
      .trim();
  }

  return (
    req.socket?.remoteAddress ||
    null
  );
}


function normalizeText(
  value,
  maxLength = 500
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  return text.slice(
    0,
    maxLength
  );
}


/*
  POST /api/analytics/event

  Public analytics endpoint.

  This records basic anonymous
  engagement events.

  No password or account information
  is collected here.
*/
router.post(
  "/event",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const {
        eventType,
        articleId,
        pagePath,
        source,
        metadata,
      } = req.body || {};

      const userAgent =
        normalizeText(
          req.headers[
            "user-agent"
          ],
          1000
        );

      /*
        We intentionally do not store
        the raw IP address.

        A future privacy layer can
        hash it before storage.
      */
      const ipHash = null;

      const event =
        await trackAnalyticsEvent(
          db,
          {
            eventType,

            articleId,

            pagePath,

            source,

            metadata,

            ipHash,

            userAgent,
          }
        );

      res.status(201).json({
        success: true,
        event,
      });

    } catch (error) {

      console.error(
        "❌ Analytics event error:",
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


/*
  GET /api/analytics/overview
*/
router.get(
  "/overview",
  async (req, res) => {
    try {

      const db =
        req.app.locals.db;

      const {
        days = 30,
      } = req.query;

      const result =
        await getAnalyticsOverview(
          db,
          days
        );

      res.json({
        success: true,
        ...result,
      });

    } catch (error) {

      console.error(
        "❌ Analytics overview error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load analytics overview.",
      });
    }
  }
);


/*
  GET /api/analytics/articles
*/
router.get(
  "/articles",
  async (req, res) => {
    try {

      const db =
        req.app.locals.db;

      const {
        days = 30,
        limit = 10,
      } = req.query;

      const articles =
        await getTopArticles(
          db,
          days,
          limit
        );

      res.json({
        success: true,
        count:
          articles.length,
        articles,
      });

    } catch (error) {

      console.error(
        "❌ Top articles analytics error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load article analytics.",
      });
    }
  }
);


/*
  GET /api/analytics/searches
*/
router.get(
  "/searches",
  async (req, res) => {
    try {

      const db =
        req.app.locals.db;

      const {
        days = 30,
        limit = 10,
      } = req.query;

      const searches =
        await getTopSearches(
          db,
          days,
          limit
        );

      res.json({
        success: true,
        count:
          searches.length,
        searches,
      });

    } catch (error) {

      console.error(
        "❌ Search analytics error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load search analytics.",
      });
    }
  }
);


/*
  GET /api/analytics/daily
*/
router.get(
  "/daily",
  async (req, res) => {
    try {

      const db =
        req.app.locals.db;

      const {
        days = 30,
      } = req.query;

      const daily =
        await getAnalyticsByDay(
          db,
          days
        );

      res.json({
        success: true,
        count:
          daily.length,
        daily,
      });

    } catch (error) {

      console.error(
        "❌ Daily analytics error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load daily analytics.",
      });
    }
  }
);


/*
  GET /api/analytics/categories
*/
router.get(
  "/categories",
  async (req, res) => {
    try {

      const db =
        req.app.locals.db;

      const {
        days = 30,
      } = req.query;

      const categories =
        await getAnalyticsByCategory(
          db,
          days
        );

      res.json({
        success: true,
        count:
          categories.length,
        categories,
      });

    } catch (error) {

      console.error(
        "❌ Category analytics error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to load category analytics.",
      });
    }
  }
);


export default router;
