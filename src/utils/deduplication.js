/**
 * Filters out items that already exist in the database
 *
 * @param {Array} scrapedItems - Array of items scraped from various platforms
 * @param {Array} existingItems - Array of existing items from database
 * @returns {Array} - Array of new items that don't exist in database
 */
function deduplicateItems(scrapedItems, existingItems) {
  console.log(
    `Deduplicating ${scrapedItems.length} scraped items against ${existingItems.length} existing items`,
  );

  // Create a Set of existing item IDs for faster lookup
  const existingItemIds = new Set(existingItems.map((item) => item.id));

  // Filter out items that already exist in the database
  const newItems = scrapedItems.filter((item) => !existingItemIds.has(item.id));

  console.log(`Found ${newItems.length} new items after deduplication`);
  return newItems;
}

export { deduplicateItems };
