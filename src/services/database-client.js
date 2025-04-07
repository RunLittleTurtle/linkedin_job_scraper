import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

class NocoDBClient {
  constructor() {
    this.apiUrl = process.env.NOCODB_API_URL;
    this.apiKey = process.env.NOCODB_API_KEY;
    this.projectId = process.env.NOCODB_PROJECT;
    this.tableId = process.env.NOCODB_TABLE;

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        "xc-auth": this.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  async getExistingRecords() {
    try {
      console.log("Fetching existing records from NocoDB...");
      const response = await this.client.get(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/views/vw_${this.tableId}?limit=1000`,
      );
      console.log(`Retrieved ${response.data.list.length} existing records`);
      return response.data.list;
    } catch (error) {
      console.error("Error fetching records from NocoDB:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      throw error;
    }
  }

  async insertRecords(records) {
    if (!records || records.length === 0) {
      console.log("No new records to insert");
      return [];
    }

    try {
      // Process in batches of 20
      const batchSize = 20;
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
      console.error("Error inserting records to NocoDB:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      throw error;
    }
  }

  async getSearchConfigurations() {
    try {
      console.log("Fetching search configurations from NocoDB...");
      const response = await this.client.get(
        `/api/v1/db/data/noco/${this.projectId}/mhiw0i2upe5zybj/views/vw_mhiw0i2upe5zybj?where=(active,eq,true)`,
      );
      console.log(
        `Retrieved ${response.data.list.length} active search configurations`,
      );
      return response.data.list;
    } catch (error) {
      console.error(
        "Error fetching search configurations from NocoDB:",
        error.message,
      );
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      throw error;
    }
  }
}

export default NocoDBClient;
