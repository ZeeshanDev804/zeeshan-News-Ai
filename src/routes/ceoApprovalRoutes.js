import express from "express";

import {
  getCEOApprovalQueue,
  getCEOApprovalById,
  approveCEOItem,
  rejectCEOItem,
  holdCEOItem,
  getCEOApprovalStats,
} from "../lib/ceoApprovalStore.js";

const router = express.Router();

/*
  GET /api/ceo-approval/queue
*/
router.get("/queue", async (req, res) => {
  try {
    const status =
      req.query.status || "pending";

    const limit =
      Number(req.query.limit) || 50;

    const items = await getCEOApprovalQueue(
      req.app.locals.db,
      {
        status,
        limit,
      }
    );

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error(
      "❌ CEO approval queue error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  GET /api/ceo-approval/stats
*/
router.get("/stats", async (req, res) => {
  try {
    const stats = await getCEOApprovalStats(
      req.app.locals.db
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error(
      "❌ CEO approval stats error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  GET /api/ceo-approval/:id
*/
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid approval ID",
      });
    }

    const item = await getCEOApprovalById(
      req.app.locals.db,
      id
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "CEO approval item not found",
      });
    }

    res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error(
      "❌ CEO approval item error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  POST /api/ceo-approval/:id/approve
*/
router.post("/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid approval ID",
      });
    }

    const approvedBy =
      req.body?.approvedBy || "CEO";

    const item = await approveCEOItem(
      req.app.locals.db,
      id,
      approvedBy
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error:
          "Approval item not found or is no longer pending",
      });
    }

    res.json({
      success: true,
      message: "CEO approval recorded",
      item,
    });
  } catch (error) {
    console.error(
      "❌ CEO approval action error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  POST /api/ceo-approval/:id/reject
*/
router.post("/:id/reject", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid approval ID",
      });
    }

    const reason =
      req.body?.reason ||
      "Rejected by CEO";

    const item = await rejectCEOItem(
      req.app.locals.db,
      id,
      reason
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error:
          "Approval item not found or is no longer pending",
      });
    }

    res.json({
      success: true,
      message: "CEO rejection recorded",
      item,
    });
  } catch (error) {
    console.error(
      "❌ CEO rejection action error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
  POST /api/ceo-approval/:id/hold
*/
router.post("/:id/hold", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid approval ID",
      });
    }

    const reason =
      req.body?.reason ||
      "Held for CEO review";

    const item = await holdCEOItem(
      req.app.locals.db,
      id,
      reason
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error:
          "Approval item not found or is no longer pending",
      });
    }

    res.json({
      success: true,
      message: "CEO hold recorded",
      item,
    });
  } catch (error) {
    console.error(
      "❌ CEO hold action error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
