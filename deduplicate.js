/**
 * Filters out job listings that already exist in the database
 *
 * @param {Array} scrapedJobs - Array of jobs scraped from LinkedIn
 * @param {Array} existingJobs - Array of existing jobs from NocoDB
 * @returns {Array} - Array of new jobs that don't exist in NocoDB
 */
function deduplicateJobs(scrapedJobs, existingJobs) {
  console.log(
    `Deduplicating ${scrapedJobs.length} scraped jobs against ${existingJobs.length} existing jobs`,
  );

  // Create a Set of existing job IDs for faster lookup
  const existingJobIds = new Set(existingJobs.map((job) => job.jobId));

  // Filter out jobs that already exist in the database
  const newJobs = scrapedJobs.filter((job) => !existingJobIds.has(job.jobId));

  console.log(`Found ${newJobs.length} new jobs after deduplication`);
  return newJobs;
}

module.exports = { deduplicateJobs };
