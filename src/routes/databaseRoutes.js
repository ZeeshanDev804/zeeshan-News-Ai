import express from "express";
import { checkDatabase } from "../services/databaseService.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    success: true,
    database: checkDatabase()
  });
});

export default router;
