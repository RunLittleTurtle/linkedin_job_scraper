import dotenv from "dotenv";
dotenv.config();
const cron = require("node-cron");
const LinkedInScraper = require("./scraper");
const NocoDBClient = require("./nocodb");
const { deduplicateJobs } = require("./deduplicate");

/**
 * Get search configurations from NocoDB with fallback to environment variables
 * @returns {Object} Object with arrays of URLs organized by source
 */
async function getSearchConfigurations() {
  try {
    // Initialize NocoDB client
    const nocodb = new NocoDBClient();

    // Try to get configurations from NocoDB first
    const configs = await nocodb.getSearchConfigurations();

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
  console.log("Starting data scraper...");

  try {
    // Get search configurations
    const urlsBySource = await getSearchConfigurations();

    // Handle LinkedIn configurations if they exist
    if (urlsBySource.linkedin && urlsBySource.linkedin.length > 0) {
      console.log(
        `Found ${urlsBySource.linkedin.length} LinkedIn configurations to process:`,
      );
      urlsBySource.linkedin.forEach((config) => {
        console.log(`- ${config.name}: ${config.url.substring(0, 50)}...`);
      });

      // Extract just the URLs for scraping
      const linkedinUrls = urlsBySource.linkedin.map((config) => config.url);

      // Initialize scraper and NocoDB client
      const scraper = new LinkedInScraper();
      const nocodb = new NocoDBClient();

      // Scrape items from LinkedIn
      console.log("Scraping data from LinkedIn...");
      // Note: still using scrapeJobs to match existing scraper.js implementation
      const scrapedJobs = await scraper.scrapeJobs(linkedinUrls);
      console.log(`Scraped ${scrapedJobs.length} items from LinkedIn`);

      // Get existing items from NocoDB
      const existingJobs = await nocodb.getExistingRecords();
      console.log(`Found ${existingJobs.length} existing items in NocoDB`);

      // Deduplicate items - still using deduplicateJobs function
      const newJobs = deduplicateJobs(scrapedJobs, existingJobs);
      console.log(`Found ${newJobs.length} new items to add to NocoDB`);

      // Insert new items into NocoDB
      if (newJobs.length > 0) {
        const insertedJobs = await nocodb.insertRecords(newJobs);
        console.log(
          `Successfully inserted ${insertedJobs.length} new items into NocoDB`,
        );
      } else {
        console.log("No new items to insert");
      }
    } else {
      console.log("No LinkedIn configurations found");
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
  if (require.main === module) {
    console.log("Script executed directly, running immediately");
    scrapeAndStoreItems();
  }
}
