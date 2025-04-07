import BaseExtractor from "./base-extractor.js";

class LinkedInExtractor extends BaseExtractor {
  constructor(browser, context) {
    super(browser, context);
  }

  /**
   * Extract basic data from a LinkedIn job card
   * @param {ElementHandle} card - Playwright element handle for card
   * @param {Object} options - Scraping options
   * @returns {Object} - Basic item data
   */
  async extractBasicData(card, options = {}) {
    try {
      // Extract job ID and URL
      const linkElement = await card.$(".job-search-card__link");
      const itemUrl = await linkElement.getAttribute("href");
      const itemId = this.extractId(itemUrl);

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
  extractId(urlOrUrn) {
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
  async extractDetailedData(basicData) {
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
}

export default LinkedInExtractor;
