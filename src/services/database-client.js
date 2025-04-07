import { Api } from "nocodb-sdk";
import config from "../config/config.js";

class DatabaseClient {
  constructor() {
    this.apiKey = config.database.apiKey;
    this.tableId = config.database.table || "mxz0oswx9ex4cvn";
    this.configTableId = config.database.configTable || "mhiw0i2upe5zybj";
    this.configViewId = config.database.configViewId || "vwpv98h8v98d2auw";
    this.projectId = "p0st31yjjxef052";

    // Initialize NocoDB SDK
    this.api = new Api({
      baseURL: "https://app.nocodb.com",
      headers: {
        "xc-token": this.apiKey,
      },
    });

    const apiKeyPreview = this.apiKey
      ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`
      : "null";
    console.log(`Initialized NocoDB SDK with API key: ${apiKeyPreview}`);
  }

  /**
   * Get search configurations from the database
   * @param {boolean} activeOnly - Whether to retrieve only active configurations
   * @returns {Promise<Array>} - List of search configurations
   */
  async getSearchConfigurations(activeOnly = true) {
    try {
      console.log(
        `Fetching search configurations from table ${this.configTableId}...`,
      );

      // Using SDK's dbViewRow.list method
      const response = await this.api.dbViewRow.list(
        "noco",
        this.projectId,
        this.configTableId,
        this.configViewId,
        {
          offset: 0,
          limit: 100,
          where: activeOnly ? "(active,eq,true)" : "",
        },
      );

      console.log(`Retrieved ${response.list.length} search configurations`);
      return response.list;
    } catch (error) {
      console.error("Error fetching search configurations:", error.message);
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

      // Get the view ID for the table
      const tableViews = await this.api.dbTableView.list(this.tableId);

      const viewId = tableViews[0]?.id;
      console.log(`Using view ID: ${viewId}`);

      if (!viewId) {
        throw new Error("Could not find view ID for table");
      }

      // Using SDK's dbViewRow.list method
      const response = await this.api.dbViewRow.list(
        "noco",
        this.projectId,
        this.tableId,
        viewId,
        {
          offset: 0,
          limit: 1000,
        },
      );

      console.log(`Retrieved ${response.list.length} existing records`);
      return response.list;
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

      const insertedRecords = [];

      // Insert each record using SDK's dbTableRow.create method
      for (let i = 0; i < records.length; i++) {
        console.log(`Inserting record ${i + 1}/${records.length}...`);

        try {
          const response = await this.api.dbTableRow.create(
            this.tableId,
            records[i],
          );

          insertedRecords.push(response);
        } catch (err) {
          console.error(`Error inserting record ${i + 1}:`, err.message);
        }

        // Add a small delay between requests
        if (i < records.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
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
