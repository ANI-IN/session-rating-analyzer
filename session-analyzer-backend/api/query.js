require("dotenv").config();
const queryGenerator = require("../backend/services/queryGenerator");
const resultAnalyzer = require("../backend/services/resultAnalyzer");
const mongoService = require("../backend/services/mongoService");

// Global context cache
let isContextInitialized = false;

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

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

    // Step 1: Generate MongoDB query
    console.log("🔄 Generating MongoDB query...");
    const mongoQuery = await queryGenerator.generateQuery(query);
    console.log("✅ MongoDB query generated");

    // Step 2: Execute query
    console.log("🔄 Executing database query...");
    const results = await mongoService.executeQueryWithRetry(mongoQuery, query);
    console.log(
      `✅ Query executed successfully, ${results.length} results found`
    );

    // Step 3: Analyze results
    console.log("🔄 Analyzing results...");
    const analysis = await resultAnalyzer.analyzeResults(query, results);
    console.log("✅ Results analyzed");

    // Response
    res.json({
      success: true,
      query: query,
      resultCount: results.length,
      analysis: analysis,
      rawResults: results.length <= 200 ? results : results.slice(0, 50),
      executionTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Query processing failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your query",
    });
  }
}
