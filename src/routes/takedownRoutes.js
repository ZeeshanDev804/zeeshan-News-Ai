import express from "express";

import {
  createTakedownComplaint,
  changeTakedownStatus,
  resolveTakedownComplaint,
  rejectTakedownComplaint,
  getTakedownComplaints,
  getTakedownCase,
} from "../lib/takedownManager.js";

const router = express.Router();


// ========================================
// CREATE TAKEDOWN COMPLAINT
// POST /api/takedown
// ========================================

router.post("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const {
      articleId,
      complainantName,
      complainantEmail,
      reason,
      sourceUrl,
    } = req.body || {};

    const result =
      await createTakedownComplaint(
        db,
        articleId,
        {
          complainantName,
          complainantEmail,
          reason,
          sourceUrl,
        }
      );

    res.status(201).json(result);

  } catch (error) {
    console.error(
      "❌ Takedown complaint error:",
      error.message
    );

    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});


// ========================================
// GET TAKEDOWN CASES
// GET /api/takedown
// ========================================

router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const {
      status,
      limit,
    } = req.query;

    const cases =
      await getTakedownComplaints(
        db,
        status || null,
        limit
      );

    res.json({
      success: true,
      count: cases.length,
      cases,
    });

  } catch (error) {
    console.error(
      "❌ Takedown list error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// ========================================
// GET SINGLE TAKEDOWN CASE
// GET /api/takedown/:articleId
// ========================================

router.get(
  "/:articleId",
  async (req, res) => {
    try {
      const db = req.app.locals.db;

      const caseData =
        await getTakedownCase(
          db,
          req.params.articleId
        );

      if (!caseData) {
        return res.status(404).json({
          success: false,
          error: "Article not found",
        });
      }

      res.json({
        success: true,
        case: caseData,
      });

    } catch (error) {
      console.error(
        "❌ Takedown case error:",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// CHANGE TAKEDOWN STATUS
// PATCH /api/takedown/:articleId/status
// ========================================

router.patch(
  "/:articleId/status",
  async (req, res) => {
    try {
      const db = req.app.locals.db;

      const {
        status,
        note,
        actor,
      } = req.body || {};

      const result =
        await changeTakedownStatus(
          db,
          req.params.articleId,
          status,
          note,
          actor || "ceo"
        );

      res.json(result);

    } catch (error) {
      console.error(
        "❌ Takedown status error:",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// RESOLVE TAKEDOWN
// POST /api/takedown/:articleId/resolve
// ========================================

router.post(
  "/:articleId/resolve",
  async (req, res) => {
    try {
      const db = req.app.locals.db;

      const {
        outcome,
        note,
      } = req.body || {};

      const result =
        await resolveTakedownComplaint(
          db,
          req.params.articleId,
          {
            outcome,
            note,
          },
          "ceo"
        );

      res.json(result);

    } catch (error) {
      console.error(
        "❌ Takedown resolution error:",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);


// ========================================
// REJECT TAKEDOWN
// POST /api/takedown/:articleId/reject
// ========================================

router.post(
  "/:articleId/reject",
  async (req, res) => {
    try {
      const db = req.app.locals.db;

      const {
        reason,
      } = req.body || {};

      const result =
        await rejectTakedownComplaint(
          db,
          req.params.articleId,
          reason,
          "ceo"
        );

      res.json(result);

    } catch (error) {
      console.error(
        "❌ Takedown rejection error:",
        error.message
      );

      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);


export default router;
