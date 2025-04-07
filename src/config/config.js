import dotenv from "dotenv";
dotenv.config();

const config = {
  database: {
    apiUrl: process.env.NOCODB_API_URL,
    apiKey: process.env.NOCODB_API_KEY,
    project: process.env.NOCODB_PROJECT,
    table: process.env.NOCODB_TABLE,
  },
  scraper: {
    maxItemsPerUrl: parseInt(process.env.MAX_ITEMS_PER_URL || "200"),
    totalItemsLimit: parseInt(process.env.TOTAL_ITEMS_LIMIT || "600"),
    concurrencyLimit: parseInt(process.env.CONCURRENCY_LIMIT || "3"),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || "3"),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
  },
  scheduler: {
    cronExpression: process.env.CRON_EXPRESSION || "30 8 * * *",
    runOnStart: process.env.RUN_ON_START === "true",
  },
};

export default config;
