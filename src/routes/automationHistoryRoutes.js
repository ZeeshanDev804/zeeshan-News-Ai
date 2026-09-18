import express from "express";

import {
  getAutomationHistory,
  getAutomationRun,
} from "../lib/automationHistory.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db =
      req.app.locals.db;

    const {
      limit,
    } = req.query;

    const history =
      await getAutomationHistory(
        db,
        limit
      );

    res.json({
      success: true,

      count:
        history.length,

      history,
    });

  } catch (error) {
    console.error(
      "❌ Automation history error:",
      error.message
    );

    res.status(500).json({
      success: false,

      error:
        error.message,
    });
  }
});

router.get(
  "/:runId",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const run =
        await getAutomationRun(
          db,
          req.params.runId
        );

      if (!run) {
        return res.status(404).json({
          success: false,

          error:
            "Automation run not found",
        });
      }

      res.json({
        success: true,

        run,
      });

    } catch (error) {
      console.error(
        "❌ Automation run detail error:",
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
