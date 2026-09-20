import express from "express";

import {
  createEngagement,
  getActiveEngagements,
  getEngagementById,
  castEngagementVote,
  getEngagementResults,
  closeEngagement,
  getEngagementStats,
  getEngagementStoreStatus,
} from "../lib/engagementStore.js";

const router = express.Router();


/*
  =========================
  ENGAGEMENT STATUS
  =========================
*/

router.get(
  "/status",
  (req, res) => {
    res.json({
      success: true,
      ...getEngagementStoreStatus(),
    });
  }
);


/*
  =========================
  ENGAGEMENT STATS
  =========================
*/

router.get(
  "/stats",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const stats =
        await getEngagementStats(
          db
        );

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  ACTIVE ENGAGEMENTS
  =========================
*/

router.get(
  "/",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        Number(
          req.query.limit
        ) || 20;

      const engagements =
        await getActiveEngagements(
          db,
          limit
        );

      res.json({
        success: true,
        engagements,
      });
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  CREATE POLL / QUIZ / VOTE
  =========================
*/

router.post(
  "/create",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const {
        articleId = null,
        type = "poll",
        question,
        options = [],
        correctOption = null,
        explanation = null,
        status = "active",
      } = req.body || {};

      const engagement =
        await createEngagement(
          db,
          {
            articleId,
            type,
            question,
            options,
            correctOption,
            explanation,
            status,
          }
        );

      res.status(201).json({
        success: true,
        message:
          "Engagement created successfully",
        engagement,
      });
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  GET SINGLE ENGAGEMENT
  =========================
*/

router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid engagement ID",
        });
      }

      const engagement =
        await getEngagementById(
          db,
          id
        );

      if (!engagement) {
        return res.status(404).json({
          success: false,
          error:
            "Engagement not found",
        });
      }

      res.json({
        success: true,
        engagement,
      });
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  CAST VOTE
  =========================
*/

router.post(
  "/:id/vote",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const pollId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          pollId
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid engagement ID",
        });
      }

      const optionKey =
        String(
          req.body?.optionKey ||
            ""
        ).trim();

      const voterKey =
        String(
          req.body?.voterKey ||
            ""
        ).trim();

      if (!optionKey) {
        return res.status(400).json({
          success: false,
          error:
            "Option key is required",
        });
      }

      if (!voterKey) {
        return res.status(400).json({
          success: false,
          error:
            "Voter key is required",
        });
      }

      const result =
        await castEngagementVote(
          db,
          {
            pollId,
            optionKey,
            voterKey,
          }
        );

      if (
        result.alreadyVoted
      ) {
        return res
          .status(409)
          .json(result);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  RESULTS
  =========================
*/

router.get(
  "/:id/results",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const pollId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          pollId
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid engagement ID",
        });
      }

      const results =
        await getEngagementResults(
          db,
          pollId
        );

      if (!results) {
        return res.status(404).json({
          success: false,
          error:
            "Engagement not found",
        });
      }

      res.json({
        success: true,
        ...results,
      });
    } catch (error) {
      next(error);
    }
  }
);


/*
  =========================
  CLOSE ENGAGEMENT
  =========================
*/

router.post(
  "/:id/close",
  async (req, res, next) => {
    try {
      const db =
        req.app.locals.db;

      const pollId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          pollId
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid engagement ID",
        });
      }

      const engagement =
        await closeEngagement(
          db,
          pollId
        );

      if (!engagement) {
        return res.status(404).json({
          success: false,
          error:
            "Engagement not found",
        });
      }

      res.json({
        success: true,
        message:
          "Engagement closed successfully",
        engagement,
      });
    } catch (error) {
      next(error);
    }
  }
);


export default router;