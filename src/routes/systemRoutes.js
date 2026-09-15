import express from "express";

import { APP_CONFIG, getSystemStatus } from "../index.js";
import {
  getNewsCategories,
  createNewsDraft
} from "../news/newsEngine.js";
import {
  getSupportedRegions
} from "../trends/trendEngine.js";
import {
  getWorkflowSteps
} from "../agents/workforceOrchestrator.js";
import {
  getApprovalTypes
} from "../agents/approvalAgent.js";
import {
  getRiskLevels,
  getRiskTypes
} from "../agents/riskAgent.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    success: true,
    app: APP_CONFIG.name,
    version: APP_CONFIG.version,
    system: getSystemStatus()
  });
});

router.get("/categories", (req, res) => {
  res.json({
    success: true,
    categories: getNewsCategories()
  });
});

router.get("/regions", (req, res) => {
  res.json({
    success: true,
    regions: getSupportedRegions()
  });
});

router.get("/workflow", (req, res) => {
  res.json({
    success: true,
    steps: getWorkflowSteps()
  });
});

router.get("/approval-types", (req, res) => {
  res.json({
    success: true,
    types: getApprovalTypes()
  });
});

router.get("/risk", (req, res) => {
  res.json({
    success: true,
    levels: getRiskLevels(),
    types: getRiskTypes()
  });
});

router.post("/draft", (req, res) => {
  try {
    const draft = createNewsDraft(req.body);

    res.status(201).json({
      success: true,
      draft
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
