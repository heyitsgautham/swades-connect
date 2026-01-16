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
// Activity ID Cache
// ============================================================================
// This section provides a cache for activity summary → real Odoo ID mapping.
// Similar to opportunities, activities from DOM extraction use hash IDs,
// but RPC interception can capture real Odoo IDs.

/**
 * Cache for activity summary → real Odoo ID mapping
 * Populated from web_search_read RPC calls when Odoo loads activity views
 */
const activityIdCache = new Map<string, number>();

/**
 * Normalize an activity summary for cache lookup
 * @param summary - The activity summary to normalize
 * @returns Normalized summary (trimmed and lowercase)
 */
export function normalizeActivitySummary(summary: string): string {
  return summary.trim().toLowerCase();
}

/**
 * Lookup the real Odoo ID for an activity by its summary.
 * Returns null if not found in cache.
 * @param summary - The activity summary to lookup
 * @returns The real Odoo ID or null if not found
 */
export function lookupActivityId(summary: string): number | null {
  return activityIdCache.get(normalizeActivitySummary(summary)) ?? null;
}

/**
 * Manually set an activity ID in the cache.
 * Used when we capture IDs from RPC mutations (create/edit).
 * @param summary - The activity summary
 * @param id - The real Odoo ID
 */
export function setActivityId(summary: string, id: number): void {
  const normalizedSummary = normalizeActivitySummary(summary);
  if (!activityIdCache.has(normalizedSummary)) {
    activityIdCache.set(normalizedSummary, id);
    console.log(`[Swades Connect] Cached activity ID: "${summary}" → ${id}`);
  }
}

/**
 * Populate the activity ID cache from web_search_read response records.
 * @param records - Array of records from web_search_read response
 */
export function populateActivityIdCache(records: Array<Record<string, unknown>>): void {
  let added = 0;
  for (const record of records) {
    const id = record.id as number | undefined;
    const summary = record.summary as string | undefined;
    
    if (id && summary) {
      const normalizedSummary = normalizeActivitySummary(summary);
      if (!activityIdCache.has(normalizedSummary)) {
        activityIdCache.set(normalizedSummary, id);
        added++;
      }
    }
  }
  
  if (added > 0) {
    console.log(`[Swades Connect] Cached ${added} activity IDs (total: ${activityIdCache.size})`);
  }
}

/**
 * Initialize the activity ID cache from chrome.storage.local.
 * Reads existing activities that have real IDs (format `act_\d+`)
 * and adds them to the cache.
 * 
 * This addresses the timing issue where web_search_read happens
 * before the RPC interceptor is installed.
 */
export async function initializeActivityIdCacheFromStorage(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('odoo_data');
    const odooData = result.odoo_data as { activities?: Array<{ id: string; summary: string }> } | undefined;
    
    if (!odooData?.activities || !Array.isArray(odooData.activities)) {
      console.log('[Swades Connect] No activities in storage to initialize cache');
      return;
    }

    let added = 0;
    for (const act of odooData.activities) {
      // Only cache entries with real Odoo IDs (format: act_<number>)
      const match = act.id?.match(/^act_(\d+)$/);
      if (match && act.summary) {
        const realId = parseInt(match[1], 10);
        const normalizedSummary = normalizeActivitySummary(act.summary);
        
        if (!activityIdCache.has(normalizedSummary)) {
          activityIdCache.set(normalizedSummary, realId);
          added++;
        }
      }
    }

    if (added > 0) {
      console.log(`[Swades Connect] Initialized cache with ${added} activity IDs from storage (total: ${activityIdCache.size})`);
    }
  } catch (error) {
    console.warn('[Swades Connect] Failed to initialize activity ID cache from storage:', error);
  }
}

/**
 * Get the current size of the activity ID cache
 * @returns The number of entries in the cache
 */
export function getActivityIdCacheSize(): number {
  return activityIdCache.size;
}

/**
 * Clear the activity ID cache
 */
export function clearActivityIdCache(): void {
  activityIdCache.clear();
}
