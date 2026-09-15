
import express from "express";
import dotenv from "dotenv";

import systemRoutes from "./src/routes/systemRoutes.js";
import databaseRoutes from "./src/routes/databaseRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/system", systemRoutes);
app.use("/api/database", databaseRoutes);

app.get("/", (req, res) => {
  res.json({
    name: "ZEESHAN NEWS AI",
    status: "online",
    message: "Global AI News Platform is running.",
    version: "1.0.0"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(
    `ZEESHAN NEWS AI running on port ${PORT}`
  );
});