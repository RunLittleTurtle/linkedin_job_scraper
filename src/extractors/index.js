import LinkedInExtractor from "./linkedin-extractor.js";

// Export platform patterns for detection
export const platformPatterns = {
  linkedin: {
    urlPattern: /linkedin\.com/i,
    listingSelector: ".job-search-card",
    detailsPath: (id) => `/jobs/view/${id}`,
  },
  indeed: {
    urlPattern: /indeed\.com/i,
    listingSelector: ".job_seen_beacon",
    detailsPath: (id) => `/viewjob?jk=${id}`,
  },
  facebook: {
    urlPattern: /facebook\.com\/marketplace/i,
    listingSelector: "div[data-testid='marketplace_feed_item']",
    detailsPath: (id) => `/marketplace/item/${id}`,
  },
  centris: {
    urlPattern: /centris\.ca/i,
    listingSelector: ".property-thumbnail-item",
    detailsPath: (id) => `/en/properties/${id}`,
  },
};

// Export a map of all extractors
export default {
  linkedin: LinkedInExtractor,
  // We'll add more extractors as we implement them:
  // indeed: IndeedExtractor,
  // facebook: FacebookExtractor,
  // centris: CentrisExtractor
};
