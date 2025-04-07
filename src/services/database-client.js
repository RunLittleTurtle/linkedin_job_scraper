import axios from "axios";
import config from "../config/config.js";

class DatabaseClient {
  constructor() {
    this.apiUrl = config.database.apiUrl;
    this.apiKey = config.database.apiKey;
    this.projectId = config.database.project;
    this.tableId = config.database.table;
    this.configTableId = config.database.configTable || "mhiw0i2upe5zybj";

    // Initialize axios client with proper logging
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        "xc-auth": this.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log(`Database client initialized for project ${this.projectId}`);
    console.log(`Base URL: ${this.apiUrl} (without sensitive info)`);
  }

  /**
   * Get search configurations from the database
   * @param {boolean} activeOnly - Whether to retrieve only active configurations
   * @returns {Promise<Array>} - List of search configurations
   */
  async getSearchConfigurations(activeOnly = true) {
    try {
      console.log(
        `Fetching search configurations from ${this.configTableId}...`,
      );
      const whereClause = activeOnly ? "?where=(active,eq,true)" : "";

      const response = await this.client.get(
        `/db/data/noco/${this.projectId}/${this.configTableId}/views/vw_${this.configTableId}${whereClause}`,
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
   * Get existing records from the database
   * @returns {Promise<Array>} - List of records
   */
  async getExistingRecords() {
    try {
      console.log(`Fetching existing records from ${this.tableId}...`);
      const response = await this.client.get(
        `/db/data/noco/${this.projectId}/${this.tableId}/views/vw_${this.tableId}`,
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
   * @returns {Promise<Array>} - Inserted records
   */
  async insertRecords(records) {
    if (!records || records.length === 0) {
      console.log("No new records to insert");
      return [];
    }

    try {
      console.log(
        `Inserting ${records.length} records into ${this.tableId}...`,
      );
      const response = await this.client.post(
        `/db/data/bulk/noco/${this.projectId}/${this.tableId}`,
        { list: records },
      );

      console.log(`Successfully inserted ${response.data.length} records`);
      return response.data;
    } catch (error) {
      console.error("Error inserting records to database:", error.message);
      this.logErrorDetails(error);
      return [];
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
