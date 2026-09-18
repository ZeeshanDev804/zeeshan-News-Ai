import express from "express";

import {
  getSourcePolicy,
  getAllSourcePolicies,
  saveSourcePolicy,
  isSourceAllowed,
} from "../lib/sourcePolicy.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db =
      req.app.locals.db;

    const policies =
      await getAllSourcePolicies(
        db
      );

    res.json({
      success: true,
      count:
        policies.length,
      policies,
    });

  } catch (error) {
    console.error(
      "❌ Source policy list error:",
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
  "/:sourceName",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const policy =
        await getSourcePolicy(
          db,
          req.params.sourceName
        );

      res.json({
        success: true,
        policy,
      });

    } catch (error) {
      console.error(
        "❌ Source policy error:",
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

router.get(
  "/:sourceName/allowed",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const result =
        await isSourceAllowed(
          db,
          req.params.sourceName
        );

      res.json({
        success: true,
        ...result,
      });

    } catch (error) {
      console.error(
        "❌ Source permission error:",
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

router.post("/", async (req, res) => {
  try {
    const db =
      req.app.locals.db;

    const {
      sourceName,
      sourceUrl,
      enabled,
      attributionRequired,
      allowFullSourceContent,
      allowAiSummary,
      copyrightRisk,
      autoHoldOnComplaint,
      notes,
    } = req.body || {};

    const policy =
      await saveSourcePolicy(
        db,
        sourceName,
        sourceUrl,
        {
          enabled,
          attributionRequired,
          allowFullSourceContent,
          allowAiSummary,
          copyrightRisk,
          autoHoldOnComplaint,
        },
        notes
      );

    res.status(201).json({
      success: true,
      policy,
    });

  } catch (error) {
    console.error(
      "❌ Source policy save error:",
      error.message
    );

    res.status(400).json({
      success: false,
      error:
        error.message,
    });
  }
});

router.patch(
  "/:sourceName",
  async (req, res) => {
    try {
      const db =
        req.app.locals.db;

      const existing =
        await getSourcePolicy(
          db,
          req.params.sourceName
        );

      const body =
        req.body || {};

      const policy =
        await saveSourcePolicy(
          db,
          req.params.sourceName,
          body.sourceUrl ??
            existing.source_url ??
            "",
          {
            enabled:
              body.enabled ??
              existing.enabled,

            attributionRequired:
              body.attributionRequired ??
              existing.attribution_required,

            allowFullSourceContent:
              body.allowFullSourceContent ??
              existing.allow_full_source_content,

            allowAiSummary:
              body.allowAiSummary ??
              existing.allow_ai_summary,

            copyrightRisk:
              body.copyrightRisk ??
              existing.copyright_risk,

            autoHoldOnComplaint:
              body.autoHoldOnComplaint ??
              existing.auto_hold_on_complaint,
          },
          body.notes ??
            existing.notes ??
            ""
        );

      res.json({
        success: true,
        policy,
      });

    } catch (error) {
      console.error(
        "❌ Source policy update error:",
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
