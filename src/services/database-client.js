import axios from "axios";
import config from "../config/config.js";

class DatabaseClient {
  constructor() {
    this.apiUrl = config.database.apiUrl;
    this.apiKey = config.database.apiKey;
    this.projectId = config.database.project;
    this.tableId = config.database.table;
    this.configTableId = process.env.NOCODB_CONFIG_TABLE || "mhiw0i2upe5zybj";

    // Initialize axios client
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        "xc-auth": this.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Get existing records from the database
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of records to retrieve
   * @param {string} options.where - WHERE clause for filtering
   * @returns {Promise<Array>} - List of records
   */
  async getExistingRecords(options = {}) {
    try {
      const limit = options.limit || 1000;
      const whereClause = options.where ? `&where=${options.where}` : "";

      console.log(
        `Fetching existing records from database (limit: ${limit})...`,
      );
      const response = await this.client.get(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/views/vw_${this.tableId}?limit=${limit}${whereClause}`,
      );

      console.log(`Retrieved ${response.data.list.length} existing records`);
      return response.data.list;
    } catch (error) {
      console.error("Error fetching records from database:", error.message);
      this.logErrorDetails(error);
      return [];
    }
  }

  /**
   * Insert new records into the database
   * @param {Array} records - Records to insert
   * @param {number} batchSize - Number of records per batch
   * @returns {Promise<Array>} - Inserted records
   */
  async insertRecords(records, batchSize = 20) {
    if (!records || records.length === 0) {
      console.log("No new records to insert");
      return [];
    }

    try {
      // Process in batches
      const batches = [];
      for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize));
      }

      console.log(
        `Inserting ${records.length} records in ${batches.length} batches`,
      );

      const insertedRecords = [];
      for (const [index, batch] of batches.entries()) {
        console.log(
          `Processing batch ${index + 1}/${batches.length} (${batch.length} records)`,
        );

        const response = await this.client.post(
          `/api/v1/db/data/bulk/noco/${this.projectId}/${this.tableId}`,
          { list: batch },
        );

        insertedRecords.push(...response.data);

        // Add a small delay between batches to avoid overwhelming the API
        if (index < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`Successfully inserted ${insertedRecords.length} records`);
      return insertedRecords;
    } catch (error) {
      console.error("Error inserting records to database:", error.message);
      this.logErrorDetails(error);
      return [];
    }
  }

  /**
   * Get search configurations from the database
   * @param {boolean} activeOnly - Whether to retrieve only active configurations
   * @returns {Promise<Array>} - List of search configurations
   */
  async getSearchConfigurations(activeOnly = true) {
    try {
      console.log("Fetching search configurations from database...");
      const whereClause = activeOnly ? "?where=(active,eq,true)" : "";

      const response = await this.client.get(
        `/api/v1/db/data/noco/${this.projectId}/${this.configTableId}/views/vw_${this.configTableId}${whereClause}`,
      );

      const configCount = response.data.list.length;
      console.log(
        `Retrieved ${configCount} ${activeOnly ? "active " : ""}search configurations`,
      );

      return response.data.list;
    } catch (error) {
      console.error(
        "Error fetching search configurations from database:",
        error.message,
      );
      this.logErrorDetails(error);
      return [];
    }
  }

  /**
   * Update a record in the database
   * @param {string} recordId - ID of the record to update
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} - Updated record
   */
  async updateRecord(recordId, data) {
    try {
      console.log(`Updating record ${recordId} in database...`);
      const response = await this.client.patch(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/${recordId}`,
        data,
      );

      console.log(`Successfully updated record ${recordId}`);
      return response.data;
    } catch (error) {
      console.error(`Error updating record ${recordId}:`, error.message);
      this.logErrorDetails(error);
      return null;
    }
  }

  /**
   * Helper method to log error details
   * @param {Error} error - Error object
   * @private
   */
  logErrorDetails(error) {
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    } else if (error.request) {
      console.error("No response received");
    }
  }
}

export default DatabaseClient;
