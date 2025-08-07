const { MongoClient } = require("mongodb");
const queryGenerator = require("./queryGenerator");

class MongoService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) return;

      this.client = new MongoClient(process.env.MONGODB_URI);
      await this.client.connect();

      this.db = this.client.db("rating-analyzer");
      this.collection = this.db.collection("sessions");

      this.isConnected = true;
      console.log("✅ Connected to MongoDB Atlas");

      // Test the connection
      await this.testConnection();
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const count = await this.collection.countDocuments();
      console.log(`📊 Database contains ${count} session records`);
      return count;
    } catch (error) {
      throw new Error(`Database test failed: ${error.message}`);
    }
  }

  async executeQueryWithRetry(mongoQuery, originalQuery, maxRetries = 2) {
    let currentQuery = mongoQuery;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Executing query (attempt ${attempt + 1}/${maxRetries})`
        );

        // Execute the aggregation pipeline
        const results = await this.collection.aggregate(currentQuery).toArray();

        console.log(
          `✅ Query executed successfully, found ${results.length} results`
        );
        return results;
      } catch (error) {
        console.error(
          `❌ Query execution failed (attempt ${attempt + 1}): ${error.message}`
        );

        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error(
            `Database query failed after ${maxRetries} attempts: ${error.message}`
          );
        }

        // Try to fix the query using ChatGPT
        try {
          console.log("🔄 Attempting to fix query with ChatGPT...");
          currentQuery = await queryGenerator.fixQuery(
            originalQuery,
            error.message,
            currentQuery
          );
          console.log("✅ Query fixed, retrying...");
        } catch (fixError) {
          console.error("❌ Failed to fix query:", fixError.message);
          throw new Error(`Query could not be fixed: ${fixError.message}`);
        }
      }
    }
  }

  async executeRawQuery(pipeline) {
    try {
      if (!this.isConnected) {
        throw new Error("Database not connected");
      }

      return await this.collection.aggregate(pipeline).toArray();
    } catch (error) {
      throw new Error(`Raw query execution failed: ${error.message}`);
    }
  }

  async getSampleData(limit = 3) {
    try {
      return await this.collection.find({}).limit(limit).toArray();
    } catch (error) {
      throw new Error(`Failed to get sample data: ${error.message}`);
    }
  }

  async getCollectionStats() {
    try {
      const stats = await this.db.runCommand({ collStats: "sessions" });
      return {
        documentCount: stats.count,
        avgDocumentSize: stats.avgObjSize,
        totalSize: stats.size,
        storageSize: stats.storageSize,
      };
    } catch (error) {
      throw new Error(`Failed to get collection stats: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log("✅ MongoDB disconnected");
      }
    } catch (error) {
      console.error("❌ Error disconnecting from MongoDB:", error.message);
    }
  }
}

module.exports = new MongoService();
