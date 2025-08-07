const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const queryGenerator = require("../backend/services/queryGenerator");
const resultAnalyzer = require("../backend/services/resultAnalyzer");
const mongoService = require("../backend/services/mongoService");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
    await initializeContexts();

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
    await initializeContexts();
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

module.exports = app;
