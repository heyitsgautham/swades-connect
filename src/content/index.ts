/**
 * Swades Connect Content Script - Main Orchestrator
 *
 * This content script handles:
 * - Data extraction from Odoo CRM pages (Contacts, Opportunities, Activities)
 * - Message passing with the service worker
 * - View detection and context gathering
 */

import { extractContacts } from './extractors/contactExtractor';
import { extractOpportunities } from './extractors/opportunityExtractor';
import { extractActivities } from './extractors/activityExtractor';
import {
  detectViewType,
  detectDataModel,
  getViewContext,
  waitForOdooReady,
  type OdooViewType,
  type OdooDataModel,
} from './viewDetector';

console.log('Swades Connect Content Script loaded');

// ============================================================================
// Type Definitions
// ============================================================================

interface ExtractionResult {
  success: boolean;
  data?: {
    contacts: ReturnType<typeof extractContacts>;
    opportunities: ReturnType<typeof extractOpportunities>;
    activities: ReturnType<typeof extractActivities>;
  };
  metadata?: {
    viewType: OdooViewType;
    dataModel: OdooDataModel;
    recordsExtracted: number;
    extractionTimeMs: number;
    timestamp: string;
  };
  error?: string;
}

interface SingleExtractionResult<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
}

interface ViewContextResult {
  success: boolean;
  context?: ReturnType<typeof getViewContext>;
  error?: string;
}

// ============================================================================
// Message Listener
// ============================================================================

/**
 * Listen for extraction requests from popup or service worker
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action } = message;

  switch (action) {
    case 'EXTRACT_DATA':
      handleExtraction()
        .then(sendResponse)
        .catch((error) => {
          console.error('[ContentScript] Extraction error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      break;

    case 'EXTRACT_CONTACTS':
      handleSingleExtraction('contacts')
        .then(sendResponse)
        .catch((error) => {
          console.error('[ContentScript] Contact extraction error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      break;

    case 'EXTRACT_OPPORTUNITIES':
      handleSingleExtraction('opportunities')
        .then(sendResponse)
        .catch((error) => {
          console.error('[ContentScript] Opportunity extraction error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      break;

    case 'EXTRACT_ACTIVITIES':
      handleSingleExtraction('activities')
        .then(sendResponse)
        .catch((error) => {
          console.error('[ContentScript] Activity extraction error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      break;

    case 'GET_VIEW_CONTEXT':
      handleGetViewContext()
        .then(sendResponse)
        .catch((error) => {
          console.error('[ContentScript] View context error:', error);
          sendResponse({ success: false, error: String(error) });
        });
      break;

    default:
      // Unknown action - don't respond
      return false;
  }

  // Return true to keep the message channel open for async response
  return true;
});

// ============================================================================
// Extraction Handlers
// ============================================================================

/**
 * Handles full data extraction based on current view context.
 *
 * Extracts appropriate data based on detected data model:
 * - res.partner → Contacts
 * - crm.lead → Opportunities
 * - mail.activity → Activities
 *
 * @returns Promise with extraction result including data and metadata
 */
async function handleExtraction(): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Detect current view and data model
    const viewType = detectViewType();
    const dataModel = detectDataModel();

    console.log(
      `[ContentScript] Extracting from ${viewType} view, model: ${dataModel}`
    );

    // Wait for Odoo to be ready (with 5 second timeout)
    try {
      await waitForOdooReady(5000);
    } catch (error) {
      console.warn('[ContentScript] Odoo ready timeout, proceeding anyway:', error);
    }

    // Additional delay for dynamic content to settle
    await delay(300);

    // Extract data based on current data model
    let contacts: ReturnType<typeof extractContacts> = [];
    let opportunities: ReturnType<typeof extractOpportunities> = [];
    let activities: ReturnType<typeof extractActivities> = [];

    switch (dataModel) {
      case 'res.partner':
        contacts = extractContacts();
        console.log(`[ContentScript] Extracted ${contacts.length} contacts`);
        break;

      case 'crm.lead':
        opportunities = extractOpportunities();
        console.log(`[ContentScript] Extracted ${opportunities.length} opportunities`);
        break;

      case 'mail.activity':
        activities = extractActivities();
        console.log(`[ContentScript] Extracted ${activities.length} activities`);
        break;

      default:
        // Unknown model - try to extract based on view elements
        console.warn(`[ContentScript] Unknown data model: ${dataModel}, attempting fallback extraction`);
        contacts = extractContacts();
        opportunities = extractOpportunities();
        activities = extractActivities();
    }

    const duration = Date.now() - startTime;
    const recordsExtracted = contacts.length + opportunities.length + activities.length;

    const result: ExtractionResult = {
      success: true,
      data: {
        contacts,
        opportunities,
        activities,
      },
      metadata: {
        viewType,
        dataModel,
        recordsExtracted,
        extractionTimeMs: duration,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('[ContentScript] Extraction successful:', {
      recordsExtracted,
      duration: `${duration}ms`,
    });

    return result;
  } catch (error) {
    console.error('[ContentScript] Extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handles extraction of a single data type.
 *
 * @param type - The type of data to extract ('contacts', 'opportunities', or 'activities')
 * @returns Promise with extraction result
 */
async function handleSingleExtraction<T>(
  type: 'contacts' | 'opportunities' | 'activities'
): Promise<SingleExtractionResult<T>> {
  try {
    // Wait for Odoo to be ready
    try {
      await waitForOdooReady(5000);
    } catch (error) {
      console.warn('[ContentScript] Odoo ready timeout, proceeding anyway:', error);
    }

    await delay(300);

    let data: unknown;
    let count: number;

    switch (type) {
      case 'contacts':
        data = extractContacts();
        count = (data as unknown[]).length;
        break;

      case 'opportunities':
        data = extractOpportunities();
        count = (data as unknown[]).length;
        break;

      case 'activities':
        data = extractActivities();
        count = (data as unknown[]).length;
        break;

      default:
        throw new Error(`Unknown extraction type: ${type}`);
    }

    console.log(`[ContentScript] Extracted ${count} ${type}`);

    return {
      success: true,
      data: data as T,
      count,
    };
  } catch (error) {
    console.error(`[ContentScript] ${type} extraction error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handles getting the current view context.
 *
 * @returns Promise with view context information
 */
async function handleGetViewContext(): Promise<ViewContextResult> {
  try {
    // Wait briefly for page to stabilize
    await delay(100);

    const context = getViewContext();

    console.log('[ContentScript] View context:', context);

    return {
      success: true,
      context,
    };
  } catch (error) {
    console.error('[ContentScript] View context error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Pagination Helpers (Stub for future implementation)
// ============================================================================

/**
 * Extracts data from all pages (pagination aware).
 *
 * This is a stub for future implementation. Currently returns
 * records from the visible page only.
 *
 * @returns Promise with all extracted records
 */
async function extractAllPages(): Promise<unknown[]> {
  const allRecords: unknown[] = [];

  try {
    // TODO: Implement pagination handling
    // For now, this is a placeholder for future infinite scroll / pagination support
    console.log('[ContentScript] Pagination extraction not yet implemented');

    // Basic strategy outline:
    // 1. Detect if pagination or infinite scroll is present
    // 2. For pagination: click through pages and extract
    // 3. For infinite scroll: scroll to bottom and extract new content
    // 4. Deduplicate records by ID

    const container = document.querySelector('.o_list_view, .o_kanban_view');
    if (container) {
      // Check for pagination controls
      const pager = document.querySelector('.o_pager');
      if (pager) {
        console.log('[ContentScript] Pagination detected but not yet handled');
      }

      // Check for infinite scroll
      const hasInfiniteScroll =
        container.scrollHeight > container.clientHeight;
      if (hasInfiniteScroll) {
        console.log('[ContentScript] Infinite scroll detected but not yet handled');
      }
    }
  } catch (error) {
    console.warn('[ContentScript] Error in pagination extraction:', error);
  }

  return allRecords;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple delay helper for waiting between operations.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export for potential testing
export {
  handleExtraction,
  handleSingleExtraction,
  handleGetViewContext,
  extractAllPages,
};
