export interface PaginationConfig {
  maxPages?: number;        // Safety limit (default: 50)
  delayBetweenPages?: number; // ms to wait after clicking next (default: 1500)
  waitForRpcCache?: boolean; // Wait for RPC cache population before extraction (default: true)
  rpcCacheTimeout?: number;  // Max time to wait for RPC cache (default: 3000ms)
  forceStableSort?: boolean; // Click column header to force stable sort (default: true for activities)
}

/**
 * Force stable sorting by clicking the first sortable column header.
 * This prevents Odoo's pagination bug where records with identical sort keys
 * can shift between pages, causing some records to be missed entirely.
 * 
 * @param delayMs - Delay after clicking to wait for page to reload
 * @returns true if sorting was changed, false otherwise
 */
async function applyStableSort(delayMs: number): Promise<boolean> {
  // Look for sortable column headers in list view
  // Prefer "Summary" or first available column for stable sorting
  const sortableHeaders = document.querySelectorAll('th.o_column_sortable');
  
  if (sortableHeaders.length === 0) {
    return false;
  }
  
  // Find "Summary" column or use first sortable column
  let targetHeader: HTMLElement | null = null;
  for (const header of sortableHeaders) {
    const text = (header as HTMLElement).textContent?.toLowerCase() || '';
    if (text.includes('summary') || text.includes('id')) {
      targetHeader = header as HTMLElement;
      break;
    }
  }
  
  // Fallback to first sortable column
  if (!targetHeader) {
    targetHeader = sortableHeaders[0] as HTMLElement;
  }
  
  // Check if already sorted by this column (has sort indicator)
  const isSorted = targetHeader.classList.contains('o_sort_up') || 
                   targetHeader.classList.contains('o_sort_down') ||
                   targetHeader.querySelector('.fa-sort-up, .fa-sort-down');
  
  if (isSorted) {
    return false;
  }
  
  targetHeader.click();
  
  // Wait for page to reload with new sort order
  await waitForPageLoad(delayMs);
  return true;
}

/**
 * Navigate to the first page before starting extraction
 * Returns true if navigation happened, false if already on first page
 */
async function navigateToFirstPage(delayMs: number): Promise<boolean> {
  const pageInfo = getCurrentPageInfo();
  
  // Already on first page
  if (!pageInfo || pageInfo.currentStart === 1) {
    return false;
  }

  // Find and click the "previous" button repeatedly until we reach page 1
  let attempts = 0;
  const maxAttempts = 50; // Safety limit

  while (attempts < maxAttempts) {
    const currentInfo = getCurrentPageInfo();
    
    if (!currentInfo || currentInfo.currentStart === 1) {
      return true;
    }

    // Try to find the "first page" button (faster)
    const firstButton = document.querySelector('.o_pager_first:not(.disabled)') as HTMLButtonElement | null;
    if (firstButton && !firstButton.disabled) {
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
  const { 
    maxPages = 50, 
    delayBetweenPages = 1500,
    waitForRpcCache = true,
    rpcCacheTimeout = 3000,
    forceStableSort = true
  } = config;
  const allData: T[] = [];
  let pageCount = 1;
  
  // STEP 0: Force stable sorting to prevent pagination instability
  // This is critical for activities where default sort (date_deadline) is not unique
  if (forceStableSort) {
    const sortChanged = await applyStableSort(delayBetweenPages);
    if (sortChanged) {
      // Wait extra time for RPC cache to repopulate after sort change
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // STEP 1: Navigate to first page if not already there
  await navigateToFirstPage(delayBetweenPages);
  
  // Track visited page ranges to detect wrap-around
  const visitedRanges = new Set<string>();

  while (pageCount <= maxPages) {
    // Get current page info BEFORE extraction
    const pageInfo = getCurrentPageInfo();
    
    if (pageInfo) {
      const rangeKey = `${pageInfo.currentStart}-${pageInfo.currentEnd}`;
      
      // Check if we've already visited this page range (wrap-around detected)
      if (visitedRanges.has(rangeKey)) {
        break;
      }
      
      // Mark this range as visited
      visitedRanges.add(rangeKey);
    }
    
    // Wait for RPC cache to be populated before extraction (prevents ID lookup misses)
    if (waitForRpcCache && pageCount > 1) {
      await waitForRpcCachePopulation(rpcCacheTimeout);
    }
    
    // Extract current page data (supports both sync and async extractors)
    const pageData = await extractorFn();
    
    // Add all records - storage layer handles deduplication by ID
    // Note: Odoo's sort order can shift between page fetches, so the same ID
    // might appear on different pages. This is NOT a duplicate - it's the same
    // record that shifted position. Storage merges by ID correctly.
    allData.push(...pageData);

    // Check if we've extracted all records based on page info
    if (pageInfo && pageInfo.currentEnd >= pageInfo.total) {
      break;
    }

    // Check if there's a next page button
    const nextButton = getNextButton();
    if (!nextButton) {
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
 * Wait for RPC cache to be populated after page navigation
 * This prevents race conditions where extraction happens before RPC interceptor
 * can cache real Odoo IDs, which causes duplicate content-hash-based IDs.
 * 
 * Strategy: Poll to check if cache size has increased, indicating new IDs were cached
 */
async function waitForRpcCachePopulation(timeout: number): Promise<void> {
  // Get cache size tracking function from global scope (set by content/index.ts)
  const getCacheSize = (window as any).__swadesCacheSize;
  
  if (!getCacheSize) {
    console.log('[Swades Connect] Cache size tracker not available, skipping wait');
    return;
  }
  
  const initialSize = getCacheSize();
  const startTime = Date.now();
  const pollInterval = 100; // Check every 100ms
  
  return new Promise((resolve) => {
    const checkCache = () => {
      const currentSize = getCacheSize();
      const elapsed = Date.now() - startTime;
      
      // Cache has grown - new IDs were added
      if (currentSize > initialSize) {
        console.log(`[Swades Connect] RPC cache populated in ${elapsed}ms (${initialSize} → ${currentSize})`);
        resolve();
        return;
      }
      
      // Timeout reached
      if (elapsed >= timeout) {
        console.log(`[Swades Connect] RPC cache wait timeout after ${elapsed}ms (size: ${currentSize})`);
        resolve();
        return;
      }
      
      // Continue polling
      setTimeout(checkCache, pollInterval);
    };
    
    // Start polling after a small delay to allow RPC to start
    setTimeout(checkCache, pollInterval);
  });
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
