import express from "express";

import {
  createSocialDistributionPackage,
  createRegionalDistributionPlan,
  scheduleSocialPackage,
} from "../lib/socialDistributionEngine.js";

import {
  saveDistributionBatch,
  saveSocialDistributionPackage,
  getSocialDistributionQueue,
  getSocialDistributionItem,
  updateSocialDistributionStatus,
  cancelSocialDistribution,
  getScheduledSocialPosts,
  getSocialDistributionStats,
} from "../lib/socialDistributionStore.js";


const router =
  express.Router();


function getDatabase(
  req
) {
  const db =
    req.app.locals.db;

  if (!db) {
    throw new Error(
      "Database connection is not available"
    );
  }

  return db;
}


/*
  GET /api/social-distribution/status
*/
router.get(
  "/status",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const stats =
        await getSocialDistributionStats(
          db
        );

      res.json({
        success: true,

        engine:
          "ZEESHAN NEWS AI Social Distribution",

        actualPublishing:
          false,

        providerConnected:
          false,

        stats,

        generatedAt:
          new Date().toISOString(),
      });

    } catch (error) {
      console.error(
        "❌ Social distribution status error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/*
  GET /api/social-distribution/queue
*/
router.get(
  "/queue",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        status,
        platform,
        articleId,
        limit,
      } = req.query;

      const queue =
        await getSocialDistributionQueue(
          db,
          {
            status,
            platform,
            articleId,
            limit,
          }
        );

      res.json({
        success: true,

        count:
          queue.length,

        queue,
      });

    } catch (error) {
      console.error(
        "❌ Social distribution queue error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/*
  GET /api/social-distribution/queue/:id
*/
router.get(
  "/queue/:id",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const item =
        await getSocialDistributionItem(
          db,
          req.params.id
        );

      if (!item) {
        return res.status(
          404
        ).json({
          success: false,

          error:
            "Distribution item not found",
        });
      }

      res.json({
        success: true,

        item,
      });

    } catch (error) {
      console.error(
        "❌ Distribution item error:",
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
  POST /api/social-distribution/generate
*/
router.post(
  "/generate",
  async (
    req,
    res
  ) => {
    try {
      const {
        article,
        platforms,
        region,
      } = req.body || {};

      if (
        !article ||
        !article.title
      ) {
        return res.status(
          400
        ).json({
          success: false,

          error:
            "Article with title is required",
        });
      }

      const result =
        await createSocialDistributionPackage(
          article,
          {
            platforms,
            region:
              region ||
              "Worldwide",
          }
        );

      res.json(
        result
      );

    } catch (error) {
      console.error(
        "❌ Social package generation error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/*
  POST /api/social-distribution/generate-and-save
*/
router.post(
  "/generate-and-save",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        article,
        platforms,
        region,
      } = req.body || {};

      if (
        !article ||
        !article.title
      ) {
        return res.status(
          400
        ).json({
          success: false,

          error:
            "Article with title is required",
        });
      }

      const generated =
        await createSocialDistributionPackage(
          article,
          {
            platforms,
            region:
              region ||
              "Worldwide",
          }
        );


      const saved =
        await saveDistributionBatch(
          db,
          {
            articleId:
              article.id ||
              null,

            region:
              region ||
              "Worldwide",

            packages:
              generated.packages ||
              [],
          }
        );


      res.json({
        success: true,

        generated,

        saved,
      });

    } catch (error) {
      console.error(
        "❌ Generate and save error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/*
  POST /api/social-distribution/save
*/
router.post(
  "/save",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        articleId,
        platform,
        region,
        status,
        content,
        safety,
        publishing,
        scheduledAt,
      } = req.body || {};


      const item =
        await saveSocialDistributionPackage(
          db,
          {
            articleId,
            platform,
            region:
              region ||
              "Worldwide",

            status:
              status ||
              "draft",

            content:
              content ||
              {},

            safety:
              safety ||
              {},

            publishing:
              publishing ||
              {},

            scheduledAt:
              scheduledAt ||
              null,
          }
        );


      res.status(
        201
      ).json({
        success: true,

        item,
      });

    } catch (error) {
      console.error(
        "❌ Save social distribution error:",
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
  POST /api/social-distribution/regional-plan
*/
router.post(
  "/regional-plan",
  async (
    req,
    res
  ) => {
    try {
      const {
        region,
        platforms,
        days,
      } = req.body || {};


      const plan =
        createRegionalDistributionPlan({
          region:
            region ||
            "Worldwide",

          platforms,

          days:
            days || 1,
        });


      res.json(
        plan
      );

    } catch (error) {
      console.error(
        "❌ Regional distribution plan error:",
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
  POST /api/social-distribution/schedule
*/
router.post(
  "/schedule",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        id,
        platform,
        region,
        content,
        publishAt,
      } = req.body || {};


      if (!content) {
        return res.status(
          400
        ).json({
          success: false,

          error:
            "Content is required",
        });
      }


      const schedule =
        scheduleSocialPackage({
          platform,

          region:
            region ||
            "Worldwide",

          content,

          publishAt,
        });


      let savedItem =
        null;


      if (id) {
        savedItem =
          await updateSocialDistributionStatus(
            db,
            id,
            "scheduled",
            {
              scheduledAt:
                schedule
                  ?.schedule
                  ?.publishAt ||
                publishAt ||
                null,

              publishingResult:
                schedule,
            }
          );

      } else {
        savedItem =
          await saveSocialDistributionPackage(
            db,
            {
              platform,

              region:
                region ||
                "Worldwide",

              status:
                "scheduled",

              content,

              publishing:
                schedule,

              scheduledAt:
                schedule
                  ?.schedule
                  ?.publishAt ||
                publishAt ||
                null,
            }
          );
      }


      res.json({
        success: true,

        schedule,

        item:
          savedItem,
      });

    } catch (error) {
      console.error(
        "❌ Schedule social post error:",
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
  GET /api/social-distribution/scheduled
*/
router.get(
  "/scheduled",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        beforeMinutes,
        limit,
      } = req.query;


      const posts =
        await getScheduledSocialPosts(
          db,
          {
            beforeMinutes,

            limit,
          }
        );


      res.json({
        success: true,

        count:
          posts.length,

        posts,
      });

    } catch (error) {
      console.error(
        "❌ Scheduled social posts error:",
        error.message
      );

      res.status(500).json({
        success: false,

        error:
          error.message,
      });
    }
  }
);


/*
  PATCH /api/social-distribution/queue/:id/status
*/
router.patch(
  "/queue/:id/status",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const {
        status,
        providerName,
        providerPostId,
        scheduledAt,
        errorMessage,
        publishingResult,
      } =
        req.body || {};


      if (!status) {
        return res.status(
          400
        ).json({
          success: false,

          error:
            "Status is required",
        });
      }


      const item =
        await updateSocialDistributionStatus(
          db,
          req.params.id,
          status,
          {
            providerName,

            providerPostId,

            scheduledAt,

            errorMessage,

            publishingResult,
          }
        );


      if (!item) {
        return res.status(
          404
        ).json({
          success: false,

          error:
            "Distribution item not found",
        });
      }


      res.json({
        success: true,

        item,
      });

    } catch (error) {
      console.error(
        "❌ Update distribution status error:",
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
  POST /api/social-distribution/queue/:id/cancel
*/
router.post(
  "/queue/:id/cancel",
  async (
    req,
    res
  ) => {
    try {
      const db =
        getDatabase(req);

      const reason =
        req.body?.reason ||
        "Cancelled by CEO";


      const item =
        await cancelSocialDistribution(
          db,
          req.params.id,
          reason
        );


      if (!item) {
        return res.status(
          404
        ).json({
          success: false,

          error:
            "Distribution item not found",
        });
      }


      res.json({
        success: true,

        item,
      });

    } catch (error) {
      console.error(
        "❌ Cancel distribution error:",
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
