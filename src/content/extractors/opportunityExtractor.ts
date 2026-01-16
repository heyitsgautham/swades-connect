import type { Opportunity } from '../../shared/types';
import { lookupOpportunityId, initializeOpportunityIdCacheFromStorage } from '../idCache';

/**
 * Generate a stable, content-based ID for records where we can't get the real Odoo ID.
 * Uses a simple hash of the content to create a deterministic ID.
 */
function generateContentHash(prefix: string, ...parts: (string | number)[]): string {
  const content = parts.map(p => String(p).trim().toLowerCase()).join('|');
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive number and then to base36 for shorter string
  const positiveHash = (hash >>> 0).toString(36);
  return `${prefix}_${positiveHash}`;
}

/**
 * Parse currency strings like "₹ 0.00" or "₹ 1,234.56" to numbers
 */
function parseRevenue(revenueText: string): number {
  if (!revenueText) return 0;
  
  try {
    // Remove currency symbols, spaces, and commas
    const cleaned = revenueText
      .replace(/[₹$€£¥]/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .trim();
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Extract opportunity from a list view row
 */
function extractOpportunityFromRow(row: HTMLElement): Opportunity | null {
  try {
    // We'll generate a content-based ID after extracting the data
    // because Odoo's data-id (e.g., "datapoint_52") changes between page loads

    // Opportunity Name: td[name="name"] → use data-tooltip attribute
    const nameCell = row.querySelector('td[name="name"]');
    const name = nameCell?.getAttribute('data-tooltip')?.trim() || 
                 nameCell?.textContent?.trim() || '';

    if (!name) {
      return null;
    }

    // Expected Revenue: td[name="expected_revenue"] → contains div span with "₹ 0.00" format
    const revenueCell = row.querySelector('td[name="expected_revenue"]');
    const revenueSpan = revenueCell?.querySelector('div span');
    const revenueText = revenueSpan?.textContent?.trim() || 
                        revenueCell?.textContent?.trim() || '0';
    const revenue = parseRevenue(revenueText);

    // Stage: td[name="stage_id"] → use data-tooltip attribute
    const stageCell = row.querySelector('td[name="stage_id"]');
    const stage = stageCell?.getAttribute('data-tooltip')?.trim() || 
                  stageCell?.textContent?.trim() || 'Unknown';

    // Contact Name: td[name="contact_name"] → use data-tooltip attribute (for reference)
    const contactCell = row.querySelector('td[name="contact_name"]');
    const _contactName = contactCell?.getAttribute('data-tooltip')?.trim() || 
                        contactCell?.textContent?.trim() || '';
    void _contactName; // Preserve for future use

    // Email: td[name="email_from"] → use data-tooltip attribute (for reference)
    const emailCell = row.querySelector('td[name="email_from"]');
    const _email = emailCell?.getAttribute('data-tooltip')?.trim() || 
                  emailCell?.textContent?.trim() || '';
    void _email; // Preserve for future use

    // Salesperson: td[name="user_id"] → contains div.o_field_many2one_avatar_user span (for reference)
    const userCell = row.querySelector('td[name="user_id"]');
    const salespersonSpan = userCell?.querySelector('div.o_field_many2one_avatar_user span');
    const _salesperson = salespersonSpan?.textContent?.trim() || 
                        userCell?.textContent?.trim() || '';
    void _salesperson; // Preserve for future use

    // Probability and close date may not be visible in list view
    // Try to extract if available
    const probabilityCell = row.querySelector('td[name="probability"]');
    const probabilityText = probabilityCell?.textContent?.trim() || '0';
    const probability = parseFloat(probabilityText.replace(/[^\d.-]/g, '')) || 0;

    const closeDateCell = row.querySelector('td[name="date_deadline"], td[name="date_closed"]');
    const closeDate = closeDateCell?.textContent?.trim() || '';

    // Try to get real Odoo ID from cache (populated by web_search_read RPC calls)
    // Fall back to content-based hash if not found
    const realId = lookupOpportunityId(name);
    const id = realId !== null 
      ? `opp_${realId}` 
      : generateContentHash('opp', name, stage, revenue);

    return {
      id,
      name,
      revenue,
      stage,
      probability,
      closeDate,
    };
  } catch (error) {
    console.warn('Error extracting opportunity from row:', error);
    return null;
  }
}

/**
 * Extract opportunity from a kanban card
 */
function extractOpportunityFromKanbanCard(
  card: HTMLElement,
  stageName: string
): Opportunity | null {
  try {
    // We'll generate a content-based ID after extracting the data
    // because Odoo's data-id (e.g., "datapoint_39") changes between page loads

    // Opportunity Name: article.o_kanban_record > span.fw-bold.fs-5
    const nameSpan = card.querySelector(':scope > span.fw-bold.fs-5');
    const name = nameSpan?.textContent?.trim() || '';

    if (!name) {
      return null;
    }

    // Revenue: div.o_kanban_card_crm_lead_revenue (may be empty)
    const revenueDiv = card.querySelector('div.o_kanban_card_crm_lead_revenue');
    const revenueText = revenueDiv?.textContent?.trim() || '0';
    const revenue = parseRevenue(revenueText);

    // Partner/Company: Find parent .d-flex container and get sibling span
    // HTML structure: <div class="d-flex"><div name="partner_id">...</div><span class="ms-2 text-truncate">Name</span></div>
    const partnerDiv = card.querySelector('div[name="partner_id"]');
    const partnerContainer = partnerDiv?.closest('.d-flex');
    const partnerSpan = partnerContainer?.querySelector('span.ms-2.text-truncate') ||
                        partnerContainer?.querySelector('span.text-truncate');
    const _partnerName = partnerSpan?.textContent?.trim() || '';
    void _partnerName; // Available for future use if Opportunity type is extended

    // Priority: div[name="priority"] - count filled stars
    // Filled stars have 'fa-star' class but NOT 'fa-star-o' (outline)
    const priorityDiv = card.querySelector('div[name="priority"]');
    const allStars = priorityDiv?.querySelectorAll('a.o_priority_star') || [];
    const filledStars = Array.from(allStars).filter(star =>
      star.classList.contains('fa-star') && !star.classList.contains('fa-star-o')
    );
    const priority = filledStars.length * 33; // Convert to percentage (0, 33, 66, 100)

    // Stage comes from the column header
    const stage = stageName || 'Unknown';

    // Close date may not be visible in kanban view
    const closeDateElement = card.querySelector('[name="date_deadline"], [name="date_closed"]');
    const closeDate = closeDateElement?.textContent?.trim() || '';

    // Try to get real Odoo ID from cache (populated by web_search_read RPC calls)
    // Fall back to content-based hash if not found
    const realId = lookupOpportunityId(name);
    const id = realId !== null 
      ? `opp_${realId}` 
      : generateContentHash('opp', name, stage, revenue);

    return {
      id,
      name,
      revenue,
      stage,
      probability: priority,
      closeDate,
    };
  } catch (error) {
    console.warn('Error extracting opportunity from kanban card:', error);
    return null;
  }
}

/**
 * Main function to extract opportunities from the current view
 * Automatically detects list or kanban view
 * 
 * Pre-populates the ID cache from storage to address the timing issue
 * where web_search_read happens before the RPC interceptor is installed.
 */
export async function extractOpportunities(): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  try {
    // Pre-populate ID cache from storage to get real Odoo IDs
    // This addresses the timing issue where web_search_read happens
    // before the RPC interceptor is installed
    await initializeOpportunityIdCacheFromStorage();

    // Check for list view first
    const listRows = document.querySelectorAll('tr.o_data_row');

    if (listRows.length > 0) {
      console.log(`[OpportunityExtractor] Extracting from list view (${listRows.length} rows)`);
      
      listRows.forEach((row, index) => {
        try {
          const opportunity = extractOpportunityFromRow(row as HTMLElement);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          console.warn(`[OpportunityExtractor] Failed to extract opportunity from row ${index}:`, error);
        }
      });

      return opportunities;
    }

    // Check for kanban view
    const kanbanGroups = document.querySelectorAll('.o_kanban_group');

    if (kanbanGroups.length > 0) {
      console.log(`[OpportunityExtractor] Extracting from kanban view (${kanbanGroups.length} stages)`);
      
      kanbanGroups.forEach((group) => {
        try {
          // Stage name: .o_kanban_group .o_kanban_header .o_column_title span.text-truncate
          const stageNameSpan = group.querySelector('.o_kanban_header .o_column_title span.text-truncate');
          const stageName = stageNameSpan?.textContent?.trim() || 'Unknown';

          // Stage revenue (for debugging/logging)
          const stageRevenueEl = group.querySelector('.o_animated_number');
          const stageRevenue = stageRevenueEl?.textContent?.trim() || '';
          
          if (stageRevenue) {
            console.log(`[OpportunityExtractor] Stage "${stageName}" total revenue: ${stageRevenue}`);
          }

          // Get all cards in this stage
          const cards = group.querySelectorAll('article.o_kanban_record');

          cards.forEach((card, index) => {
            try {
              const opportunity = extractOpportunityFromKanbanCard(card as HTMLElement, stageName);
              if (opportunity) {
                opportunities.push(opportunity);
              }
            } catch (error) {
              console.warn(`[OpportunityExtractor] Failed to extract opportunity from card ${index} in stage "${stageName}":`, error);
            }
          });
        } catch (error) {
          console.warn('[OpportunityExtractor] Failed to process kanban group:', error);
        }
      });

      return opportunities;
    }

    console.log('[OpportunityExtractor] No list or kanban view detected');

  } catch (error) {
    console.error('[OpportunityExtractor] Error in opportunity extraction:', error);
  }

  return opportunities;
}
