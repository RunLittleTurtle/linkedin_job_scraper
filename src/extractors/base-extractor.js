class BaseExtractor {
  constructor(browser, context) {
    this.browser = browser;
    this.context = context;
    this.requestTimeout = 30000;
  }

  /**
   * Utility to estimate date from relative time
   * @param {string} relativeTime - Relative time string (e.g., "2 days ago")
   * @returns {string|null} - ISO date string or null
   */
  estimateDateFromRelativeTime(relativeTime) {
    if (!relativeTime) return null;

    const now = new Date();

    // Match patterns like "2 days ago", "3 weeks ago", etc.
    const match = relativeTime.match(/(\d+)\s+(\w+)\s+ago/i);
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit.includes("minute")) {
      now.setMinutes(now.getMinutes() - amount);
    } else if (unit.includes("hour")) {
      now.setHours(now.getHours() - amount);
    } else if (unit.includes("day")) {
      now.setDate(now.getDate() - amount);
    } else if (unit.includes("week")) {
      now.setDate(now.getDate() - amount * 7);
    } else if (unit.includes("month")) {
      now.setMonth(now.getMonth() - amount);
    } else if (unit.includes("year")) {
      now.setFullYear(now.getFullYear() - amount);
    }

    return now.toISOString();
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
}

export default BaseExtractor;
