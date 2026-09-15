
import express from "express";
import { checkDatabase } from "../services/databaseService.js";

const router = express.Router();

router.get("/status", async (req, res) => {
  const database = await checkDatabase();

  res.json({
    success: database.status !== "ERROR",
    database
  });
});

export default router;