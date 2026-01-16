export interface PaginationConfig {
  maxPages?: number;        // Safety limit (default: 50)
  delayBetweenPages?: number; // ms to wait after clicking next (default: 1500)
}

/**
 * Navigate to the first page before starting extraction
 * Returns true if navigation happened, false if already on first page
 */
async function navigateToFirstPage(delayMs: number): Promise<boolean> {
  const pageInfo = getCurrentPageInfo();
  
  // Already on first page
  if (!pageInfo || pageInfo.currentStart === 1) {
    console.log('[Swades Connect] Already on first page');
    return false;
  }

  console.log(`[Swades Connect] Currently on page with records ${pageInfo.currentRange}, navigating to page 1...`);

  // Find and click the "previous" button repeatedly until we reach page 1
  let attempts = 0;
  const maxAttempts = 50; // Safety limit

  while (attempts < maxAttempts) {
    const currentInfo = getCurrentPageInfo();
    
    if (!currentInfo || currentInfo.currentStart === 1) {
      console.log('[Swades Connect] Reached page 1');
      return true;
    }

    // Try to find the "first page" button (faster)
    const firstButton = document.querySelector('.o_pager_first:not(.disabled)') as HTMLButtonElement | null;
    if (firstButton && !firstButton.disabled) {
      console.log('[Swades Connect] Clicking first page button');
      firstButton.click();
      await waitForPageLoad(delayMs);
      return true;
    }

    // Otherwise, click previous button
    const prevButton = document.querySelector('.o_pager_previous:not(.disabled)') as HTMLButtonElement | null;
    if (!prevButton || prevButton.disabled) {
      console.warn('[Swades Connect] Cannot navigate to first page - no previous button');
      return false;
    }

    prevButton.click();
    await waitForPageLoad(delayMs);
    attempts++;
  }

  console.warn('[Swades Connect] Failed to reach first page after max attempts');
  return false;
}

/**
 * Extract data across multiple Odoo pages using pagination
 * Automatically clicks through pages and collects all data
 * 
 * IMPORTANT: Always starts from page 1, then navigates through all pages.
 * Odoo's pagination wraps around (last page -> first page) instead of disabling
 * the next button, so we track page ranges to detect completion.
 * 
 * Supports both synchronous and asynchronous extractor functions.
 */
export async function extractWithPagination<T>(
  extractorFn: () => T[] | Promise<T[]>,
  config: PaginationConfig = {}
): Promise<T[]> {
  const { maxPages = 50, delayBetweenPages = 1500 } = config;
  const allData: T[] = [];
  let pageCount = 1;
  
  // STEP 1: Navigate to first page if not already there
  await navigateToFirstPage(delayBetweenPages);
  
  // Track visited page ranges to detect wrap-around
  const visitedRanges = new Set<string>();

  // Get initial page info
  const initialPageInfo = getCurrentPageInfo();
  if (initialPageInfo) {
    console.log(`[Swades Connect] Starting pagination from page 1: ${initialPageInfo.currentRange} / ${initialPageInfo.total} total records`);
  }

  while (pageCount <= maxPages) {
    // Get current page info BEFORE extraction
    const pageInfo = getCurrentPageInfo();
    
    if (pageInfo) {
      const rangeKey = `${pageInfo.currentStart}-${pageInfo.currentEnd}`;
      
      // Check if we've already visited this page range (wrap-around detected)
      if (visitedRanges.has(rangeKey)) {
        console.log(`[Swades Connect] Detected wrap-around at ${rangeKey}, stopping pagination`);
        break;
      }
      
      // Mark this range as visited
      visitedRanges.add(rangeKey);
      
      console.log(`[Swades Connect] Extracting page ${pageCount} (records ${rangeKey})...`);
    } else {
      console.log(`[Swades Connect] Extracting page ${pageCount}...`);
    }
    
    // Extract current page data (supports both sync and async extractors)
    const pageData = await extractorFn();
    allData.push(...pageData);
    console.log(`[Swades Connect] Page ${pageCount}: extracted ${pageData.length} records (total: ${allData.length})`);

    // Check if we've extracted all records based on page info
    if (pageInfo && pageInfo.currentEnd >= pageInfo.total) {
      console.log(`[Swades Connect] Reached last page (${pageInfo.currentEnd} >= ${pageInfo.total})`);
      break;
    }

    // Check if there's a next page button
    const nextButton = getNextButton();
    if (!nextButton) {
      console.log('[Swades Connect] Next button not found or disabled');
      break;
    }

    // Click next button
    nextButton.click();
    
    // Wait for new content to load
    await waitForPageLoad(delayBetweenPages);
    
    pageCount++;
  }

  if (pageCount >= maxPages) {
    console.warn(`[Swades Connect] Reached max page limit (${maxPages}). Some records may not be extracted.`);
  }

  console.log(`[Swades Connect] Pagination complete: extracted ${allData.length} items from ${pageCount} pages`);
  return allData;
}

/**
 * Get the next page button if available and enabled
 */
function getNextButton(): HTMLButtonElement | null {
  // Odoo v19 uses .o_pager_next class with disabled attribute
  const nextButton = document.querySelector('.o_pager_next') as HTMLButtonElement | null;
  
  if (nextButton && !nextButton.disabled && !nextButton.hasAttribute('disabled')) {
    return nextButton;
  }
  
  return null;
}

async function waitForPageLoad(baseDelay: number): Promise<void> {
  // Wait for loading spinner to appear and disappear
  const loadingSelector = '.o_loading, .o_list_table_loading, .o_loading_indicator';
  
  // Short delay for spinner to appear
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Wait for spinner to disappear (max 5s timeout)
  const maxWait = 5000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const loading = document.querySelector(loadingSelector);
    if (!loading) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Additional safety delay to ensure DOM is updated
  await new Promise(resolve => setTimeout(resolve, baseDelay));
}

/**
 * Check if there's a next page available
 * Returns true if the next button exists and is not disabled
 */
export function hasNextPage(): boolean {
  const nextButton = document.querySelector('.o_pager_next') as HTMLButtonElement | null;
  return !!nextButton && !nextButton.disabled && !nextButton.hasAttribute('disabled');
}

/**
 * Get current page info from Odoo pager
 * Odoo shows pagination like: "1-80 / 302" or "1-1 / 1"
 */
export function getCurrentPageInfo(): { currentRange: string; total: number; currentStart: number; currentEnd: number } | null {
  // Odoo v19 structure: .o_pager_value (e.g., "1-80") and .o_pager_limit (e.g., "302")
  const pagerValue = document.querySelector('.o_pager_value');
  const pagerLimit = document.querySelector('.o_pager_limit');
  
  if (pagerValue && pagerLimit) {
    const currentRange = pagerValue.textContent?.trim() || '';
    const total = parseInt(pagerLimit.textContent?.trim() || '0', 10);
    
    // Parse the range (e.g., "1-80" or "81-160")
    const rangeMatch = currentRange.match(/(\d+)-?(\d+)?/);
    const currentStart = rangeMatch ? parseInt(rangeMatch[1], 10) : 1;
    const currentEnd = rangeMatch && rangeMatch[2] ? parseInt(rangeMatch[2], 10) : currentStart;
    
    return { currentRange, total, currentStart, currentEnd };
  }
  
  // Fallback: try the older .o_pager_counter format
  const pagerCounter = document.querySelector('.o_pager_counter');
  if (pagerCounter) {
    const text = pagerCounter.textContent || '';
    // Matches "1-80 / 302" or "1 / 5"
    const match = text.match(/(\d+)(?:-(\d+))?\s*\/\s*(\d+)/);
    if (match) {
      const currentStart = parseInt(match[1], 10);
      const currentEnd = match[2] ? parseInt(match[2], 10) : currentStart;
      const total = parseInt(match[3], 10);
      const currentRange = match[2] ? `${currentStart}-${currentEnd}` : `${currentStart}`;
      return { currentRange, total, currentStart, currentEnd };
    }
  }
  
  return null;
}
