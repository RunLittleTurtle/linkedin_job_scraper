import { chromium } from "playwright";
import UserAgent from "user-agents";
import pLimit from "p-limit";
import config from "../config/config.js";

/**
 * Universal web scraper for extracting data from various platforms
 */
class UniversalScraper {
  constructor() {
    this.maxItemsPerUrl = config.scraper.maxItemsPerUrl;
    this.totalItemsLimit = config.scraper.totalItemsLimit;
    this.concurrencyLimit = config.scraper.concurrencyLimit;
    this.retryAttempts = config.scraper.retryAttempts || 3;
    this.requestTimeout = config.scraper.requestTimeout || 30000;
    this.browser = null;
    this.context = null;

    // Platform detection patterns
    this.platformPatterns = {
      linkedin: {
        urlPattern: /linkedin\.com/i,
        listingSelector: ".job-search-card",
        detailsPath: (id) => `/jobs/view/${id}`,
      },
      indeed: {
        urlPattern: /indeed\.com/i,
        listingSelector: ".jobCard",
        detailsPath: (id) => `/viewjob?jk=${id}`,
      },
      // Add more platforms as needed
    };
  }

  /**
   * Initialize the browser for scraping
   */
  async initBrowser() {
    console.log("Initializing browser...");
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      userAgent: new UserAgent().toString(),
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
    });

    // Block unnecessary resources for performance
    await this.context.route(
      "**/*.{png,jpg,jpeg,gif,svg,pdf,css,font,woff,woff2}",
      (route) => route.abort(),
    );
    await this.context.route("**/analytics/**", (route) => route.abort());
    await this.context.route("**/ads/**", (route) => route.abort());

    console.log("Browser initialized");
  }

  /**
   * Random delay to simulate human behavior
   * @param {number} min - Minimum delay in milliseconds
   * @param {number} max - Maximum delay in milliseconds
   */
  async randomDelay(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Detect which platform a URL belongs to
   * @param {string} url - URL to analyze
   * @returns {string|null} - Platform name or null if not detected
   */
  detectPlatform(url) {
    for (const [platform, { urlPattern }] of Object.entries(
      this.platformPatterns,
    )) {
      if (urlPattern.test(url)) {
        return platform;
      }
    }
    return null;
  }

  /**
   * Scroll to load more content on a page
   * @param {Page} page - Playwright page object
   * @param {string} platform - Platform name
   */
  async scrollToLoadMore(page, platform) {
    console.log("Scrolling to load more content...");

    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;

    while (scrollAttempts < maxScrollAttempts) {
      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for potential content to load
      await this.randomDelay(1000, 2000);

      // Check if we've reached the end
      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight,
      );

      if (currentHeight === previousHeight) {
        // Platform-specific "load more" buttons
        if (platform === "linkedin") {
          const showMoreButton = page.locator(
            "button.infinite-scroller__show-more-button",
          );
          if (
            (await showMoreButton.count()) > 0 &&
            (await showMoreButton.isVisible())
          ) {
            console.log('Clicking "Show more" button');
            await showMoreButton.click();
            await this.randomDelay();
            continue;
          }
        } else if (platform === "indeed") {
          const showMoreButton = page.locator(
            "[data-testid='pagination-page-next']",
          );
          if (
            (await showMoreButton.count()) > 0 &&
            (await showMoreButton.isVisible())
          ) {
            console.log('Clicking "Next page" button');
            await showMoreButton.click();
            await this.randomDelay(3000, 5000);
            continue;
          }
        }
        // Add other platform-specific "load more" handling here

        console.log("Reached the end of the listings");
        break;
      }

      previousHeight = currentHeight;
      scrollAttempts++;
    }

    console.log(`Finished scrolling after ${scrollAttempts} attempts`);
  }

  /**
   * Extract basic data from a LinkedIn job card
   * @param {ElementHandle} card - Playwright element handle for card
   * @param {Object} options - Scraping options
   * @returns {Object} - Basic item data
   */
  async extractLinkedInBasicData(card, options = {}) {
    try {
      // Extract job ID and URL
      const linkElement = await card.$(".job-search-card__link");
      const itemUrl = await linkElement.getAttribute("href");
      const itemId = this.extractLinkedInId(itemUrl);

      // Extract job title
      const title = await linkElement.innerText();

      // Extract company name and URL
      const companyElement = await card.$(".job-search-card__company-name");
      const companyName = await companyElement.innerText();

      const companyLinkElement = await card.$(
        ".job-search-card__company-name a",
      );
      const companyUrl = companyLinkElement
        ? await companyLinkElement.getAttribute("href")
        : null;

      // Extract location
      const locationElement = await card.$(".job-search-card__location");
      const location = await locationElement.innerText();

      // Extract posted time
      const postedTimeElement = await card.$("time");
      const postedTime = await postedTimeElement.innerText();
      const publishedAt = await postedTimeElement.getAttribute("datetime");

      // Return data in standardized structure
      return {
        // Core universal fields
        id: itemId,
        title: title,
        url: itemUrl,
        description: "", // Will be filled in detailed view
        location: location,
        publishedAt: publishedAt,
        scrapedAt: new Date().toISOString(),

        // Source metadata
        source: {
          platform: "linkedin",
          type: "job",
          category: options.category || "",
        },

        // Organization information
        organization: {
          name: companyName,
          url: companyUrl,
          id: "",
        },

        // Platform-specific details (will be populated in detailed view)
        details: {
          postedTime: postedTime,
        },
      };
    } catch (error) {
      console.error("Error extracting LinkedIn basic data:", error);
      return null;
    }
  }

  /**
   * Extract ID from a LinkedIn URL or entity URN
   * @param {string} urlOrUrn - LinkedIn URL or entity URN
   * @returns {string} - Item ID
   */
  extractLinkedInId(urlOrUrn) {
    if (urlOrUrn.includes("urn:li:jobPosting:")) {
      // Extract from URN format: "urn:li:jobPosting:3544610012"
      return urlOrUrn.split(":").pop();
    } else if (urlOrUrn.includes("/jobs/view/")) {
      // Extract from URL format: "https://www.linkedin.com/jobs/view/3544610012"
      const match = urlOrUrn.match(/\/jobs\/view\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Extract detailed data from LinkedIn job detail page
   * @param {Object} basicData - Basic data extracted from card
   * @returns {Object} - Complete item data
   */
  async extractLinkedInDetailedData(basicData) {
    console.log(
      `Extracting detailed data for LinkedIn job: ${basicData.id} - ${basicData.title}`,
    );

    let page = null;
    try {
      page = await this.context.newPage();

      // Navigate to detail page
      await page.goto(basicData.url, {
        waitUntil: "networkidle",
        timeout: this.requestTimeout,
      });
      await this.randomDelay(1000, 3000);

      // Extract description
      const descriptionElement = await page.$(".description__text");
      const description = descriptionElement
        ? await descriptionElement.innerText()
        : "";

      // Extract job-specific details
      const criteriaItems = await page.$$(".job-criteria-item");
      let contractType = "";
      let experienceLevel = "";
      let industry = "";
      let workType = "";

      for (const item of criteriaItems) {
        const header = await item.$(".job-criteria-subheader");
        const value = await item.$(".job-criteria-text");

        if (!header || !value) continue;

        const headerText = await header.innerText();
        const valueText = await value.innerText();

        if (headerText.includes("Seniority level")) {
          experienceLevel = valueText;
        } else if (headerText.includes("Employment type")) {
          contractType = valueText;
        } else if (headerText.includes("Industry")) {
          industry = valueText;
        }
      }

      // Extract information about work type (remote, onsite, hybrid)
      const workplaceTypes = await page.$$(".job-detail-location-metadata");
      for (const item of workplaceTypes) {
        const text = await item.innerText();
        if (
          text.includes("Remote") ||
          text.includes("On-site") ||
          text.includes("Hybrid")
        ) {
          workType = text.trim();
          break;
        }
      }

      // Extract other LinkedIn-specific fields
      let applicationsCount = "";
      const applicationsElement = await page.$(".num-applicants__caption");
      if (applicationsElement) {
        applicationsCount = await applicationsElement.innerText();
      }

      // Extract salary information if available
      let salary = "";
      const salaryElement = await page.$(
        '.job-details-jobs-unified-top-card__job-insight span:has-text("$")',
      );
      if (salaryElement) {
        salary = await salaryElement.innerText();
      }

      // Extract company ID if available
      let companyId = "";
      if (basicData.organization.url) {
        const companyUrlMatch =
          basicData.organization.url.match(/\/company\/([^\/]+)/);
        companyId = companyUrlMatch ? companyUrlMatch[1] : "";
      }

      await page.close();

      // Return enhanced data with the same structure, adding description and details
      return {
        ...basicData,
        description: description,
        organization: {
          ...basicData.organization,
          id: companyId,
        },
        details: {
          ...basicData.details,
          contractType: contractType,
          experienceLevel: experienceLevel,
          workType: workType,
          industry: industry,
          applicationsCount: applicationsCount,
          salary: salary,
        },
      };
    } catch (error) {
      console.error(
        `Error extracting detailed data for item ${basicData.id}:`,
        error,
      );
      if (page) await page.close();

      // Return basic data without details on error
      return basicData;
    }
  }

  /**
   * Extract basic data from a card based on platform
   * @param {ElementHandle} card - Playwright element handle for card
   * @param {string} platform - Platform name
   * @param {Object} options - Scraping options
   * @returns {Promise<Object>} - Basic item data
   */
  async extractBasicData(card, platform, options = {}) {
    switch (platform) {
      case "linkedin":
        return this.extractLinkedInBasicData(card, options);
      // Add cases for other platforms
      default:
        console.warn(`No extractor defined for platform: ${platform}`);
        return null;
    }
  }

  /**
   * Extract detailed data based on platform
   * @param {Object} basicData - Basic data with platform field
   * @returns {Promise<Object>} - Detailed item data
   */
  async extractDetailedData(basicData) {
    const platform = basicData.source.platform;
    switch (platform) {
      case "linkedin":
        return this.extractLinkedInDetailedData(basicData);
      // Add cases for other platforms
      default:
        console.warn(`No detailed extractor defined for platform: ${platform}`);
        return basicData;
    }
  }

  /**
   * Scrape items from a single URL
   * @param {string} url - Search URL
   * @param {Object} options - Scraping options
   * @returns {Array} - Array of item data
   */
  async scrapeFromUrl(url, options = {}) {
    const platform = this.detectPlatform(url);
    if (!platform) {
      console.error(`Unsupported platform for URL: ${url}`);
      return [];
    }

    console.log(`Starting to scrape ${platform} data from URL: ${url}`);

    const page = await this.context.newPage();
    const items = [];

    try {
      // Navigate to the search URL
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: this.requestTimeout,
      });
      console.log(`Page loaded, waiting for ${platform} items to appear...`);

      // Wait for items to load
      const listingSelector = this.platformPatterns[platform].listingSelector;
      await page.waitForSelector(listingSelector, { timeout: 30000 });

      // Scroll to load more items
      await this.scrollToLoadMore(page, platform);

      // Extract all item cards
      const cards = await page.$$(listingSelector);
      console.log(`Found ${cards.length} items`);

      // Limit to max items per URL
      const cardsToProcess = cards.slice(0, this.maxItemsPerUrl);

      // Extract basic data from each card
      const basicItemsData = [];
      for (const card of cardsToProcess) {
        const basicData = await this.extractBasicData(card, platform, options);
        if (basicData) {
          basicItemsData.push(basicData);
        }
      }

      console.log(`Extracted basic data for ${basicItemsData.length} items`);

      // Extract detailed data with concurrency limit if detailed option is true
      if (options.detailed !== false) {
        const limit = pLimit(this.concurrencyLimit);
        const detailedItemsPromises = basicItemsData.map((basicData) =>
          limit(() => this.extractDetailedData(basicData)),
        );

        const detailedItems = await Promise.all(detailedItemsPromises);
        items.push(...detailedItems.filter(Boolean));
      } else {
        items.push(...basicItemsData);
      }

      console.log(`Successfully scraped ${items.length} items from URL`);
    } catch (error) {
      console.error(`Error scraping from URL (${platform}):`, error);
    } finally {
      await page.close();
    }

    return items;
  }

  /**
   * Scrape items from multiple URLs
   * @param {Array} urls - Array of URLs to scrape
   * @param {Object} options - Scraping options
   * @returns {Array} - Array of item data
   */
  async scrapeMultipleUrls(urls, options = {}) {
    console.log(`Starting to scrape ${urls.length} URLs`);

    // Initialize browser if not already initialized
    if (!this.browser) {
      await this.initBrowser();
    }

    let allItems = [];

    try {
      // Process each URL sequentially to avoid detection
      for (const url of urls) {
        const items = await this.scrapeFromUrl(url, options);
        allItems.push(...items);

        // Check if we've reached the total items limit
        if (allItems.length >= this.totalItemsLimit) {
          console.log(`Reached total items limit of ${this.totalItemsLimit}`);
          allItems = allItems.slice(0, this.totalItemsLimit);
          break;
        }

        // Add a delay between URLs
        await this.randomDelay(5000, 10000);
      }
    } catch (error) {
      console.error("Error in scraping process:", error);
    } finally {
      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
      }
    }

    console.log(`Scraped a total of ${allItems.length} items`);
    return allItems;
  }
}

export default UniversalScraper;
