const { chromium } = require("playwright");
const UserAgent = require("user-agents");
const pLimit = require("p-limit");
require("dotenv").config();

class LinkedInScraper {
  constructor() {
    this.maxJobsPerUrl = parseInt(process.env.MAX_JOBS_PER_URL || "200");
    this.totalJobsLimit = parseInt(process.env.TOTAL_JOBS_LIMIT || "600");
    this.concurrencyLimit = parseInt(process.env.CONCURRENCY_LIMIT || "3");
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
   * Extract job ID from LinkedIn job URL or entity URN
   * @param {string} urlOrUrn - LinkedIn job URL or entity URN
   * @returns {string} - Job ID
   */
  extractJobId(urlOrUrn) {
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
   * Scroll to load more job cards
   * @param {Page} page - Playwright page object
   */
  async scrollToLoadMoreJobs(page) {
    console.log("Scrolling to load more jobs...");

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
        // Try clicking "Show more" button if it exists
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
        } else {
          console.log("Reached the end of the job listings");
          break;
        }
      }

      previousHeight = currentHeight;
      scrollAttempts++;
    }

    console.log(`Finished scrolling after ${scrollAttempts} attempts`);
  }

  /**
   * Extract basic job data from job card on search results page
   * @param {ElementHandle} jobCard - Playwright element handle for job card
   * @returns {Object} - Basic job data
   */
  async extractBasicJobData(jobCard) {
    try {
      // Extract job ID and URL
      const jobLinkElement = await jobCard.$(".job-search-card__link");
      const jobUrl = await jobLinkElement.getAttribute("href");
      const jobId = this.extractJobId(jobUrl);

      // Extract job title
      const jobTitle = await jobLinkElement.innerText();

      // Extract company name and URL
      const companyElement = await jobCard.$(".job-search-card__company-name");
      const companyName = await companyElement.innerText();

      const companyLinkElement = await jobCard.$(
        ".job-search-card__company-name a",
      );
      const companyUrl = companyLinkElement
        ? await companyLinkElement.getAttribute("href")
        : null;

      // Extract location
      const locationElement = await jobCard.$(".job-search-card__location");
      const location = await locationElement.innerText();

      // Extract posted time
      const postedTimeElement = await jobCard.$("time");
      const postedTime = await postedTimeElement.innerText();
      const publishedAt = await postedTimeElement.getAttribute("datetime");

      return {
        jobId,
        jobTitle,
        jobUrl,
        companyName,
        companyUrl,
        location,
        postedTime,
        publishedAt,
        applyUrl: jobUrl,
      };
    } catch (error) {
      console.error("Error extracting basic job data:", error);
      return null;
    }
  }

  /**
   * Extract detailed job data from job detail page
   * @param {Object} basicJobData - Basic job data extracted from job card
   * @returns {Object} - Complete job data
   */
  async extractDetailedJobData(basicJobData) {
    console.log(
      `Extracting detailed data for job: ${basicJobData.jobId} - ${basicJobData.jobTitle}`,
    );

    let page = null;
    try {
      page = await this.context.newPage();

      // Navigate to job detail page
      await page.goto(basicJobData.jobUrl, { waitUntil: "networkidle" });
      await this.randomDelay(1000, 3000);

      // Extract job description
      const descriptionElement = await page.$(".description__text");
      const jobDescription = descriptionElement
        ? await descriptionElement.innerText()
        : "";

      // Extract job criteria items
      const criteriaItems = await page.$$(".job-criteria-item");
      let contractType = "";
      let experienceLevel = "";
      let sector = "";
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
          sector = valueText;
        } else if (headerText.includes("Job function")) {
          // Can be used for additional categorization
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

      // Extract application count if available
      let applicationsCount = "";
      const applicationsElement = await page.$(".num-applicants__caption");
      if (applicationsElement) {
        applicationsCount = await applicationsElement.innerText();
      }

      // Extract company ID if available
      let companyId = "";
      if (basicJobData.companyUrl) {
        const companyUrlMatch =
          basicJobData.companyUrl.match(/\/company\/([^\/]+)/);
        companyId = companyUrlMatch ? companyUrlMatch[1] : "";
      }

      // Extract apply button type
      let applyType = "";
      if (await page.$(".jobs-apply-button--top-card")) {
        applyType = "EASY_APPLY";
      } else if (
        await page.$(
          'a[data-tracking-control-name="public_jobs_apply-link-offsite_sign_in"]',
        )
      ) {
        applyType = "EXTERNAL_APPLY";
      }

      // Extract poster information if available
      let posterFullName = "";
      let posterProfileUrl = "";
      const posterElement = await page.$(".jobs-poster__name");
      if (posterElement) {
        posterFullName = await posterElement.innerText();
        const posterLink = await posterElement.$("a");
        if (posterLink) {
          posterProfileUrl = await posterLink.getAttribute("href");
        }
      }

      // Extract salary information if available
      let salary = "";
      const salaryElement = await page.$(
        '.job-details-jobs-unified-top-card__job-insight span:has-text("$")',
      );
      if (salaryElement) {
        salary = await salaryElement.innerText();
      }

      // Extract benefits if available
      let benefits = "";
      const benefitsElements = await page.$$(".jobs-benefits__list-item");
      if (benefitsElements.length > 0) {
        const benefitsList = [];
        for (const benefit of benefitsElements) {
          benefitsList.push(await benefit.innerText());
        }
        benefits = benefitsList.join(", ");
      }

      await page.close();

      // Combine basic and detailed job data
      return {
        ...basicJobData,
        jobDescription,
        applicationsCount,
        contractType,
        experienceLevel,
        workType,
        sector,
        salary,
        posterFullName,
        posterProfileUrl,
        companyId,
        applyType,
        benefits,
      };
    } catch (error) {
      console.error(
        `Error extracting detailed job data for job ${basicJobData.jobId}:`,
        error,
      );
      if (page) await page.close();

      // Return basic job data without details on error
      return basicJobData;
    }
  }

  /**
   * Scrape jobs from a single LinkedIn search URL
   * @param {string} url - LinkedIn search URL
   * @returns {Array} - Array of job data
   */
  async scrapeJobsFromUrl(url) {
    console.log(`Starting to scrape jobs from URL: ${url}`);

    const page = await this.context.newPage();
    const jobs = [];

    try {
      // Navigate to the LinkedIn search URL
      await page.goto(url, { waitUntil: "networkidle" });
      console.log("Page loaded, waiting for job cards to appear...");

      // Wait for job cards to load
      await page.waitForSelector(".job-search-card", { timeout: 30000 });

      // Scroll to load more job cards
      await this.scrollToLoadMoreJobs(page);

      // Extract all job cards
      const jobCards = await page.$$(".job-search-card");
      console.log(`Found ${jobCards.length} job cards`);

      // Limit to max jobs per URL
      const jobCardsToProcess = jobCards.slice(0, this.maxJobsPerUrl);

      // Extract basic job data from each card
      const basicJobsData = [];
      for (const jobCard of jobCardsToProcess) {
        const basicJobData = await this.extractBasicJobData(jobCard);
        if (basicJobData) {
          basicJobsData.push(basicJobData);
        }
      }

      console.log(`Extracted basic data for ${basicJobsData.length} jobs`);

      // Process detailed job data with concurrency limit
      const limit = pLimit(this.concurrencyLimit);
      const detailedJobsPromises = basicJobsData.map((basicJobData) =>
        limit(() => this.extractDetailedJobData(basicJobData)),
      );

      const detailedJobs = await Promise.all(detailedJobsPromises);
      jobs.push(...detailedJobs.filter(Boolean));

      console.log(`Successfully scraped ${jobs.length} jobs from URL`);
    } catch (error) {
      console.error("Error scraping jobs from URL:", error);
    } finally {
      await page.close();
    }

    return jobs;
  }

  /**
   * Scrape jobs from multiple LinkedIn search URLs
   * @param {Array} urls - Array of LinkedIn search URLs
   * @returns {Array} - Array of job data
   */
  async scrapeJobs(urls) {
    console.log(`Starting to scrape jobs from ${urls.length} URLs`);

    // Initialize browser if not already initialized
    if (!this.browser) {
      await this.initBrowser();
    }

    let allJobs = [];

    try {
      // Process each URL sequentially to avoid detection
      for (const url of urls) {
        const jobs = await this.scrapeJobsFromUrl(url);
        allJobs.push(...jobs);

        // Check if we've reached the total jobs limit
        if (allJobs.length >= this.totalJobsLimit) {
          console.log(`Reached total jobs limit of ${this.totalJobsLimit}`);
          allJobs = allJobs.slice(0, this.totalJobsLimit);
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

    console.log(`Scraped a total of ${allJobs.length} jobs`);
    return allJobs;
  }
}

module.exports = LinkedInScraper;
