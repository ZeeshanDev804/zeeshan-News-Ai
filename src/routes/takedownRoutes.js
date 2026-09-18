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
          error: "Takedown complaint not found",
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