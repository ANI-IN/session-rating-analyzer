require("dotenv").config();
const mongoService = require("../backend/services/mongoService");
const queryGenerator = require("../backend/services/queryGenerator");
const resultAnalyzer = require("../backend/services/resultAnalyzer");

let isContextInitialized = false;

async function initializeContexts() {
  if (!isContextInitialized) {
    console.log("🔄 Initializing contexts for health check...");
    await queryGenerator.initialize();
    await resultAnalyzer.initialize();
    await mongoService.connect();
    isContextInitialized = true;
    console.log("✅ Contexts initialized for health check");
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    await initializeContexts();
    await mongoService.testConnection();

    res.json({
      success: true,
      message: "Server and database are healthy",
      contextInitialized: isContextInitialized,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      success: false,
      error: "Database connection failed",
      details: error.message,
    });
  }
}
