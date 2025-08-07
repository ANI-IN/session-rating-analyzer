const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const queryGenerator = require("./services/queryGenerator");
const resultAnalyzer = require("./services/resultAnalyzer");
const mongoService = require("./services/mongoService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Global context cache - persists until server restart
let isContextInitialized = false;

// Initialize contexts on server startup
async function initializeContexts() {
  if (!isContextInitialized) {
    console.log("🔄 Initializing global contexts...");
    await queryGenerator.initialize();
    await resultAnalyzer.initialize();
    await mongoService.connect();
    isContextInitialized = true;
    console.log("✅ Global contexts initialized");
  }
}

// Main query endpoint
app.post("/api/query", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      });
    }

    console.log(`📝 Processing query: "${query}"`);

    // Step 1: Generate MongoDB query using ChatGPT
    console.log("🔄 Generating MongoDB query...");
    const mongoQuery = await queryGenerator.generateQuery(query);
    console.log("✅ MongoDB query generated");

    // Step 2: Execute query with retry logic
    console.log("🔄 Executing database query...");
    const results = await mongoService.executeQueryWithRetry(mongoQuery, query);
    console.log(
      `✅ Query executed successfully, ${results.length} results found`
    );

    // Step 3: Analyze results using ChatGPT
    console.log("🔄 Analyzing results...");
    const analysis = await resultAnalyzer.analyzeResults(query, results);
    console.log("✅ Results analyzed");

    // Response
    res.json({
      success: true,
      query: query,
      resultCount: results.length,
      analysis: analysis,
      rawResults: results.length <= 200 ? results : results.slice(0, 50), // Include raw data for complete analysis
      executionTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Query processing failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your query",
    });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await mongoService.testConnection();
    res.json({
      success: true,
      message: "Server and database are healthy",
      contextInitialized: isContextInitialized,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Database connection failed",
    });
  }
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// For Vercel deployment - handle all other routes
app.get("*", (req, res) => {
  // Check if it's an API route
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  } else {
    // Serve frontend for all other routes
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  }
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("🔄 Initializing application...");

  try {
    await initializeContexts();
    console.log("✅ Application ready!");
  } catch (error) {
    console.error("❌ Failed to initialize:", error.message);
    // Don't exit on Vercel
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down gracefully...");
  await mongoService.disconnect();
  console.log("✅ Database disconnected");
  server.close(() => {
    process.exit(0);
  });
});

// Export for Vercel
module.exports = app;
