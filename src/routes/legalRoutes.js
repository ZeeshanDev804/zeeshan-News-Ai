import express from "express";

import {
  receiveTakedownComplaint,
  changeTakedownStatus,
  getTakedownStatus,
  getArticleComplaints,
  getRecentComplaints,
} from "../lib/takedownManager.js";

import {
  getLegalReviewQueue,
  getLegalReviewItem,
  approveLegalReview,
  rejectLegalReview,
} from "../lib/legalReviewQueue.js";

import {
  getArticleLegalAudit,
  getRecentLegalAudit,
} from "../lib/legalAudit.js";

import {
  getCopyrightStatus,
} from "../lib/copyrightProtection.js";


const router = express.Router();


// ========================================
// GET LEGAL REVIEW QUEUE
// ========================================

router.get(
  "/review-queue",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        req.query.limit || 100;

      const queue =
        await getLegalReviewQueue(
          db,
          limit
        );

      res.json({
        success: true,
        count: queue.length,
        items: queue,
      });

    } catch (error) {
      console.error(
        "Legal review queue error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Failed to load legal review queue",
      });
    }
  }
);


// ========================================
// GET RECENT TAKEDOWN COMPLAINTS
// ========================================

router.get(
  "/complaints",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        req.query.limit || 100;

      const complaints =
        await getRecentComplaints(
          db,
          limit
        );

      res.json({
        success: true,
        count:
          complaints.length,
        complaints,
      });

    } catch (error) {
      console.error(
        "Complaints error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Failed to load complaints",
      });
    }
  }
);


// ========================================
// RECEIVE TAKEDOWN COMPLAINT
// ========================================

router.post(
  "/complaint",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await receiveTakedownComplaint(
          db,
          req.body || {}
        );

      res.status(201).json(
        result
      );

    } catch (error) {
      console.error(
        "Takedown complaint error:",
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


// ========================================
// GET SINGLE ARTICLE LEGAL REVIEW
// ========================================

router.get(
  "/article/:id",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const item =
        await getLegalReviewItem(
          db,
          req.params.id
        );

      if (!item) {
        return res.status(404).json({
          success: false,
          error:
            "Article not found",
        });
      }

      res.json({
        success: true,
        ...item,
      });

    } catch (error) {
      console.error(
        "Legal article error:",
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


// ========================================
// GET COPYRIGHT STATUS
// ========================================

router.get(
  "/article/:id/copyright",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const status =
        await getCopyrightStatus(
          db,
          req.params.id
        );

      if (!status) {
        return res.status(404).json({
          success: false,
          error:
            "Article not found",
        });
      }

      res.json({
        success: true,
        status,
      });

    } catch (error) {
      console.error(
        "Copyright status error:",
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


// ========================================
// GET ARTICLE COMPLAINTS
// ========================================

router.get(
  "/article/:id/complaints",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const complaints =
        await getArticleComplaints(
          db,
          req.params.id
        );

      res.json({
        success: true,
        count:
          complaints.length,
        complaints,
      });

    } catch (error) {
      console.error(
        "Article complaints error:",
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


// ========================================
// GET ARTICLE LEGAL AUDIT
// ========================================

router.get(
  "/article/:id/audit",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const audit =
        await getArticleLegalAudit(
          db,
          req.params.id
        );

      res.json({
        success: true,
        count:
          audit.length,
        audit,
      });

    } catch (error) {
      console.error(
        "Legal audit error:",
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


// ========================================
// CHANGE TAKEDOWN STATUS
// ========================================

router.patch(
  "/complaint/:articleId/status",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await changeTakedownStatus(
          db,
          req.params.articleId,
          req.body?.status,
          req.body?.note
        );

      res.json(
        result
      );

    } catch (error) {
      console.error(
        "Takedown status error:",
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


// ========================================
// APPROVE LEGAL REVIEW
// ========================================

router.post(
  "/review/:articleId/approve",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await approveLegalReview(
          db,
          req.params.articleId,
          req.body?.note,
          req.body?.actor || "ceo"
        );

      res.json(
        result
      );

    } catch (error) {
      console.error(
        "Legal approval error:",
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


// ========================================
// REJECT LEGAL REVIEW
// ========================================

router.post(
  "/review/:articleId/reject",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await rejectLegalReview(
          db,
          req.params.articleId,
          req.body?.note,
          req.body?.actor || "ceo"
        );

      res.json(
        result
      );

    } catch (error) {
      console.error(
        "Legal rejection error:",
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


// ========================================
// GET RECENT LEGAL AUDIT
// ========================================

router.get(
  "/audit",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const limit =
        req.query.limit || 100;

      const audit =
        await getRecentLegalAudit(
          db,
          limit
        );

      res.json({
        success: true,
        count:
          audit.length,
        audit,
      });

    } catch (error) {
      console.error(
        "Recent legal audit error:",
        error.message
      );

      res.status(500).json({
        success: false,
        error:
          "Failed to load legal audit",
      });
    }
  }
);


export default router;
