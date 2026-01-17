// ============================================================================
// Opportunity ID Cache
// ============================================================================
// This module provides a cache for opportunity name → real Odoo ID mapping.
// Separated into its own module to avoid circular dependencies between
// content/index.ts and content/extractors/opportunityExtractor.ts

/**
 * Cache for opportunity name → real Odoo ID mapping
 * Populated from web_search_read RPC calls when Odoo loads list/kanban views
 */
const opportunityIdCache = new Map<string, number>();

/**
 * Normalize an opportunity name for cache lookup
 * @param name - The opportunity name to normalize
 * @returns Normalized name (trimmed and lowercase)
 */
export function normalizeOpportunityName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Lookup the real Odoo ID for an opportunity by its name.
 * Returns null if not found in cache.
 * @param name - The opportunity name to lookup
 * @returns The real Odoo ID or null if not found
 */
export function lookupOpportunityId(name: string): number | null {
  return opportunityIdCache.get(normalizeOpportunityName(name)) ?? null;
}

/**
 * Populate the opportunity ID cache from web_search_read response records.
 * @param records - Array of records from web_search_read response
 */
export function populateOpportunityIdCache(records: Array<Record<string, unknown>>): void {
  let added = 0;
  for (const record of records) {
    const id = record.id as number | undefined;
    const name = record.name as string | undefined;
    
    if (id && name) {
      const normalizedName = normalizeOpportunityName(name);
      if (!opportunityIdCache.has(normalizedName)) {
        opportunityIdCache.set(normalizedName, id);
        added++;
      }
    }
  }
  
  if (added > 0) {
    console.log(`[Swades Connect] Cached ${added} opportunity IDs (total: ${opportunityIdCache.size})`);
  }
}

/**
 * Manually set an opportunity ID in the cache.
 * Used when we capture IDs from RPC mutations (create/edit).
 * @param name - The opportunity name
 * @param id - The real Odoo ID
 */
export function setOpportunityId(name: string, id: number): void {
  const normalizedName = normalizeOpportunityName(name);
  if (!opportunityIdCache.has(normalizedName)) {
    opportunityIdCache.set(normalizedName, id);
    console.log(`[Swades Connect] Cached opportunity ID: "${name}" → ${id}`);
  }
}

/**
 * Initialize the opportunity ID cache from chrome.storage.local.
 * Reads existing opportunities that have real IDs (format `opp_\d+`)
 * and adds them to the cache.
 * 
 * This addresses the timing issue where web_search_read happens
 * before the RPC interceptor is installed.
 */
export async function initializeOpportunityIdCacheFromStorage(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('odoo_data');
    const odooData = result.odoo_data as { opportunities?: Array<{ id: string; name: string }> } | undefined;
    
    if (!odooData?.opportunities || !Array.isArray(odooData.opportunities)) {
      console.log('[Swades Connect] No opportunities in storage to initialize cache');
      return;
    }

    let added = 0;
    for (const opp of odooData.opportunities) {
      // Only cache entries with real Odoo IDs (format: opp_<number>)
      const match = opp.id?.match(/^opp_(\d+)$/);
      if (match && opp.name) {
        const realId = parseInt(match[1], 10);
        const normalizedName = normalizeOpportunityName(opp.name);
        
        if (!opportunityIdCache.has(normalizedName)) {
          opportunityIdCache.set(normalizedName, realId);
          added++;
        }
      }
    }

    if (added > 0) {
      console.log(`[Swades Connect] Initialized cache with ${added} opportunity IDs from storage (total: ${opportunityIdCache.size})`);
    }
  } catch (error) {
    console.warn('[Swades Connect] Failed to initialize opportunity ID cache from storage:', error);
  }
}

/**
 * Get the current size of the opportunity ID cache
 * @returns The number of entries in the cache
 */
export function getOpportunityIdCacheSize(): number {
  return opportunityIdCache.size;
}

/**
 * Clear the opportunity ID cache
 */
export function clearOpportunityIdCache(): void {
  opportunityIdCache.clear();
}

// ============================================================================
// Activity ID Cache & RPC Data Accumulator
// ============================================================================
// This section provides a cache for activity IDs from RPC responses.
// Since activity summaries are NOT unique (unlike opportunity names),
// we use an ordered array that matches the DOM row order.
//
// Additionally, we accumulate FULL activity records from RPC responses
// to handle Odoo's unstable pagination. This allows us to extract from
// RPC data directly instead of DOM when needed.

/**
 * Ordered array of activity IDs from RPC responses
 * Each page load populates this with IDs in the order they appear
 */
let activityIdArray: number[] = [];

/**
 * Global set of ALL unique activity IDs seen across ALL pages during extraction
 * This helps track if Odoo's unstable sort caused us to miss any records
 */
let allSeenActivityIds = new Set<number>();

/**
 * Global map of ALL activity records seen via RPC during extraction session
 * Key is the activity ID, value is the full RPC record
 * This allows us to extract from RPC data when DOM extraction misses records
 */
let allActivityRecords = new Map<number, Record<string, unknown>>();

/**
 * Start a new extraction session - resets tracking but KEEPS accumulated RPC records
 * We keep RPC records because they were captured during page load (before extraction starts)
 */
export function startActivityExtractionSession(): void {
  // DON'T clear allActivityRecords - we need the records from initial page load!
  // Only reset the ID tracking set for fresh comparison
  allSeenActivityIds = new Set<number>(allActivityRecords.keys());
}

/**
 * Get all unique activity IDs seen across all pages during this extraction session
 */
export function getAllSeenActivityIds(): Set<number> {
  return new Set(allSeenActivityIds);
}

/**
 * Get all activity records accumulated from RPC during this extraction session
 * Returns a new Map to prevent external mutation
 */
export function getAllActivityRecords(): Map<number, Record<string, unknown>> {
  return new Map(allActivityRecords);
}

/**
 * Lookup the real Odoo ID for an activity by its row index.
 * @param rowIndex - The 0-based index of the row in the current page
 * @returns The real Odoo ID or null if not found
 */
export function lookupActivityId(rowIndex: number): number | null {
  if (rowIndex >= 0 && rowIndex < activityIdArray.length) {
    return activityIdArray[rowIndex];
  }
  return null;
}

/**
 * Populate the activity ID cache from web_search_read response records.
 * REPLACES the cache with new IDs (for fresh page of data).
 * Also accumulates IDs and FULL records into global maps for session tracking.
 * @param records - Array of records from web_search_read response
 */
export function populateActivityIdCache(records: Array<Record<string, unknown>>): void {
  // Replace cache with new page's IDs
  activityIdArray = [];
  
  for (const record of records) {
    const id = record.id as number | undefined;
    if (id) {
      activityIdArray.push(id);
      // Track ID in global set
      allSeenActivityIds.add(id);
      // Store full record in global map (overwrites if duplicate - that's fine)
      allActivityRecords.set(id, record);
    }
  }
  

}

/**
 * Get the current activity ID array (for debugging)
 */
export function getActivityIdArray(): number[] {
  return [...activityIdArray];
}

/**
 * Manually set an activity ID in the cache.
 * Used when we capture IDs from RPC mutations (create/edit).
 * For row-index approach, this appends the ID to the array.
 * @param _summary - The activity summary (unused in row-index approach, kept for API compatibility)
 * @param id - The real Odoo ID
 */
export function setActivityId(_summary: string, id: number): void {
  if (!activityIdArray.includes(id)) {
    activityIdArray.push(id);
  }
}

/**
 * Get the current size of the activity ID cache
 * @returns The number of entries in the cache
 */
export function getActivityIdCacheSize(): number {
  return activityIdArray.length;
}

/**
 * Clear the activity ID cache
 */
export function clearActivityIdCache(): void {
  activityIdArray = [];
}

/**
 * Initialize the activity ID cache from chrome.storage.local.
 * For the row-index based approach, this is a no-op since we rely on
 * RPC interception to populate the cache in real-time.
 * 
 * This function is kept for API compatibility.
 */
export async function initializeActivityIdCacheFromStorage(): Promise<void> {
  // The row-index based approach doesn't need storage initialization
  // IDs are populated fresh from each RPC call
}
