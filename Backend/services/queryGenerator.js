const OpenAI = require('openai');

class QueryGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isInitialized = false;
    this.context = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.context = `You are a MongoDB query generator for a session rating database.

DATABASE SCHEMA:
Collection: sessions
Document Structure:
{
  "_id": ObjectId,
  "topicCode": "string (e.g., 'Test Review Session')",
  "type": "string (e.g., 'SRE Assignment Review')",
  "domain": "string (e.g., 'SRE', 'Cloud', 'Backend', 'Frontend', 'Data Science')",
  "class": "string (e.g., 'Cloud Computing & AWS Services')",
  "cohorts": ["array of strings"],
  "instructor": "string (e.g., 'Rishi Bollu')",
  "sessionDate": "Date",
  "ratings": {
    "overallAverage": "number (1-5 scale)",
    "totalResponses": "number",
    "studentsAttended": "number", 
    "cohortStrength": "number",
    "percentRated": "number (percentage)",
    "yesResponses": "number",
    "noResponses": "number",
    "yesPercent": "number",
    "noPercent": "number"
  },
  "metadata": {
    "sourceSheet": "string",
    "sheetRowNumber": "number",
    "lastSyncedAt": "Date"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}

IMPORTANT RULES:
1. Always return ONLY valid MongoDB aggregation pipeline as JSON array
2. Use aggregation pipeline format: [{ $match: {...} }, { $group: {...} }, ...]
3. For date queries, use proper MongoDB date operators like $gte, $lte
4. For quarter calculations: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
5. Use $dateToString, $year, $month for date formatting
6. For rating improvements, use $group and $project to calculate differences
7. Handle case-insensitive text matching with regex when needed
8. Return empty array [] if query cannot be converted to MongoDB

EXAMPLES:
Query: "Average rating for Rishi Bollu"
Response: [{"$match":{"instructor":"Rishi Bollu"}},{"$group":{"_id":null,"avgRating":{"$avg":"$ratings.overallAverage"},"totalSessions":{"$sum":1}}}]

Query: "Sessions in 2024"  
Response: [{"$match":{"sessionDate":{"$gte":"2024-01-01T00:00:00.000Z","$lte":"2024-12-31T23:59:59.999Z"}}}]

Convert the user's English query into a MongoDB aggregation pipeline. Return only the JSON array.`;

    this.isInitialized = true;
    console.log('✅ Query Generator context initialized');
  }

  async generateQuery(userQuery) {
    if (!this.isInitialized) {
      throw new Error('Query Generator not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.context },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const generatedQuery = response.choices[0].message.content.trim();
      
      // Try to parse as JSON to validate
      let mongoQuery;
      try {
        mongoQuery = JSON.parse(generatedQuery);
        if (!Array.isArray(mongoQuery)) {
          throw new Error('Query must be an array');
        }
      } catch (parseError) {
        throw new Error(`Invalid MongoDB query generated: ${parseError.message}`);
      }

      console.log('Generated MongoDB Query:', JSON.stringify(mongoQuery, null, 2));
      return mongoQuery;

    } catch (error) {
      console.error('Error generating query:', error.message);
      throw new Error(`Failed to generate MongoDB query: ${error.message}`);
    }
  }

  async fixQuery(originalQuery, errorMessage, failedQuery) {
    const fixPrompt = `The previous MongoDB query failed with error: "${errorMessage}"

Original user request: "${originalQuery}"
Failed query: ${JSON.stringify(failedQuery)}

Please provide a corrected MongoDB aggregation pipeline that fixes this error.
Return only the corrected JSON array.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.context },
          { role: 'user', content: fixPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const fixedQuery = JSON.parse(response.choices[0].message.content.trim());
      console.log('Fixed MongoDB Query:', JSON.stringify(fixedQuery, null, 2));
      return fixedQuery;

    } catch (error) {
      throw new Error(`Failed to fix query: ${error.message}`);
    }
  }
}

module.exports = new QueryGenerator();