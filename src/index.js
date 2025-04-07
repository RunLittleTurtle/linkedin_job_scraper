import dotenv from "dotenv";
import cron from "node-cron";
import UniversalScraper from "./services/universal-scraper.js";
import DatabaseClient from "./services/database-client.js";
import { deduplicateItems } from "./utils/deduplication.js";

import http from "http";

// Create HTTP server to keep the app running and allow manual triggers
const server = http.createServer((req, res) => {
  if (req.url === "/run-scraper") {
    console.log("Manual trigger received, starting scraper...");

    // Run the scraper asynchronously
    scrapeAndStoreItems().catch((err) => {
      console.error("Error running scraper from manual trigger:", err);
    });

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Scraper started! Check logs for progress.");
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(
      "Universal Web Scraper is running. Visit /run-scraper to trigger scraping manually.",
    );
  }
});

// Start the server (add this before your other code)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

dotenv.config();

/**
 * Get search configurations from NocoDB with fallback to environment variables
 * @returns {Object} Object with arrays of URLs organized by source
 */
async function getSearchConfigurations() {
  try {
    // Initialize NocoDB client
    const database = new DatabaseClient();

    // Try to get configurations from NocoDB first
    const configs = await database.getSearchConfigurations();

    if (configs && configs.length > 0) {
      console.log(`Found ${configs.length} search configurations in NocoDB`);

      // Group configurations by source
      const urlsBySource = {};

      configs.forEach((config) => {
        if (!urlsBySource[config.source]) {
          urlsBySource[config.source] = [];
        }

        urlsBySource[config.source].push({
          id: config.id,
          name: config.name,
          category: config.category,
          url: config.url,
        });
      });

      return urlsBySource;
    }

    console.log(
      "No configurations found in NocoDB, falling back to environment variables",
    );
  } catch (error) {
    console.error("Error fetching configurations from NocoDB:", error.message);
    console.log("Falling back to environment variables");
  }

  // Fallback to environment variables if NocoDB fails or has no configs
  const urlsBySource = {};

  Object.keys(process.env).forEach((key) => {
    const sourceMatch = key.match(/^([A-Z]+)_URL_(.+)$/);

    if (sourceMatch) {
      const source = sourceMatch[1].toLowerCase();
      const category = sourceMatch[2].toLowerCase().replace(/_/g, " ");

      if (!urlsBySource[source]) {
        urlsBySource[source] = [];
      }

      urlsBySource[source].push({
        name: sourceMatch[2].replace(/_/g, " "),
        category: category,
        url: process.env[key],
      });
    }
  });

  return urlsBySource;
}

/**
 * Main function to scrape items and store in NocoDB
 */
async function scrapeAndStoreItems() {
  console.log("Starting universal data scraper...");

  try {
    // Get search configurations
    const urlsBySource = await getSearchConfigurations();

    // Initialize the database client
    const database = new DatabaseClient();

    // Process each platform's configurations
    for (const [platform, configs] of Object.entries(urlsBySource)) {
      if (configs.length > 0) {
        console.log(
          `Found ${configs.length} ${platform} configurations to process:`,
        );
        configs.forEach((config) => {
          console.log(`- ${config.name}: ${config.url.substring(0, 50)}...`);
        });

        // Extract URLs for scraping
        const urls = configs.map((config) => config.url);

        // Initialize universal scraper
        const scraper = new UniversalScraper();

        // Add options based on platform type
        const options = {
          detailed: true,
          category: configs[0].category,
          // Add any platform-specific options here
        };

        // Scrape items using the universal scraper
        console.log(`Scraping data from ${platform}...`);
        const scrapedItems = await scraper.scrapeMultipleUrls(urls, options);
        console.log(`Scraped ${scrapedItems.length} items from ${platform}`);

        // Get existing items from database
        const existingItems = await database.getExistingRecords();
        console.log(`Found ${existingItems.length} existing items in database`);

        // Deduplicate items - update deduplication function name
        const newItems = deduplicateItems(scrapedItems, existingItems);
        console.log(`Found ${newItems.length} new items to add to database`);

        // Insert new items into database
        if (newItems.length > 0) {
          const insertedItems = await database.insertRecords(newItems);
          console.log(
            `Successfully inserted ${insertedItems.length} new items into database`,
          );
        } else {
          console.log("No new items to insert");
        }
      } else {
        console.log(`No ${platform} configurations found`);
      }
    }

    console.log("Data scraping completed successfully");
  } catch (error) {
    console.error("Error in data scraping process:", error);
  }
}

// If using scheduled execution through Fly.io Machines
if (process.env.RUN_ON_START === "true") {
  console.log("Running scraper on startup as specified by RUN_ON_START");
  scrapeAndStoreItems();
} else {
  // Schedule to run every day at 8:30 AM if running as a service
  cron.schedule("30 8 * * *", () => {
    console.log("Running scheduled scraper at 8:30 AM");
    scrapeAndStoreItems();
  });

  console.log("Scheduler initialized. Data scraper will run at 8:30 AM daily.");

  // Run immediately when script is executed directly
  if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Script executed directly, running immediately");
    scrapeAndStoreItems();
  }
}
