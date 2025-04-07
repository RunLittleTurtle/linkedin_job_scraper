import { Api } from "nocodb-sdk";
import config from "../config/config.js";

class DatabaseClient {
  constructor() {
    this.apiKey = config.database.apiKey;

    // Project ID
    this.projectId = "p0st31yjjxef052";

    // Config table details
    this.configTableId = config.database.configTable || "mhiw0i2upe5zybj";
    this.configViewId = config.database.configViewId || "vwpv98h8v98d2auw";

    // Results table details
    this.resultsTableId = config.database.table || "mxz0oswx9ex4cvn";
    this.resultsViewId = config.database.resultsViewId || "vww8pja5jm99sk0m";

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
    console.log(`Project ID: ${this.projectId}`);
    console.log(
      `Config Table: ${this.configTableId} (View: ${this.configViewId})`,
    );
    console.log(
      `Results Table: ${this.resultsTableId} (View: ${this.resultsViewId})`,
    );
  }

  /**
   * Get search configurations from the database
   * @param {boolean} activeOnly - Whether to retrieve only active configurations
   * @returns {Promise<Array>} - List of search configurations
   */
  async getSearchConfigurations(activeOnly = true) {
    try {
      console.log(`Fetching search configurations...`);

      // Using SDK's dbViewRow.list method with config table and view
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
      console.log(`Fetching existing scraped results...`);

      // Using SDK's dbViewRow.list method with results table and view
      const response = await this.api.dbViewRow.list(
        "noco",
        this.projectId,
        this.resultsTableId,
        this.resultsViewId,
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
      console.log(`Inserting ${records.length} records into results table...`);

      const insertedRecords = [];

      // Insert each record using SDK's dbTableRow.create method
      for (let i = 0; i < records.length; i++) {
        console.log(`Inserting record ${i + 1}/${records.length}...`);

        try {
          const response = await this.api.dbTableRow.create(
            this.resultsTableId,
            records[i],
          );

          insertedRecords.push(response);
        } catch (err) {
          console.error(`Error inserting record ${i + 1}:`, err.message);
          this.logErrorDetails(err);
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
