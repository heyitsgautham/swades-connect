import { extractContacts } from './extractors/contactExtractor';
import { extractOpportunities } from './extractors/opportunityExtractor';
import { extractActivities } from './extractors/activityExtractor';
import { detectViewType, detectDataModel } from './viewDetector';
import type { ExtensionMessage, MessageResponse } from '../shared/messages';

console.log('[Swades Connect] Content script loaded on:', window.location.href);

/**
 * Listen for extraction requests from service worker
 * Uses hybrid async pattern with sendResponse callback for reliability
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/messaging
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: MessageResponse) => void): boolean => {
    console.log('[Swades Connect] Content script received:', message.action);

    if (message.action === 'EXTRACT_DATA') {
      // Execute async handler and send response via callback
      handleExtraction()
        .then(sendResponse)
        .catch((error) => {
          console.error('[Swades Connect] Extraction handler error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        });

      // Return true to indicate we will send response asynchronously
      return true;
    }

    // Return false for messages we don't handle
    return false;
  }
);

/**
 * Handle extraction request - returns Promise<MessageResponse>
 */
async function handleExtraction(): Promise<MessageResponse> {
  const extractionId = `extraction_${Date.now()}`;

  try {
    console.log(`[${extractionId}] Starting extraction...`);

    // Detect current context
    const viewType = detectViewType();
    const dataModel = detectDataModel();

    console.log(`[${extractionId}] View: ${viewType}, Model: ${dataModel}`);

    // Wait for Odoo to render
    await waitForOdooRender(extractionId);

    // Extract based on model
    const contacts = 
      dataModel === 'res.partner' ? extractContacts() : [];
    const opportunities = 
      dataModel === 'crm.lead' ? extractOpportunities() : [];
    const activities = 
      dataModel === 'mail.activity' ? extractActivities() : [];

    const totalRecords = contacts.length + opportunities.length + activities.length;

    console.log(
      `[${extractionId}] Extracted: ${contacts.length} contacts, ` +
      `${opportunities.length} opportunities, ${activities.length} activities`
    );

    // Send EXTRACTION_COMPLETE message to service worker (fire and forget with await)
    try {
      await chrome.runtime.sendMessage({
        action: 'EXTRACTION_COMPLETE',
        data: {
          contacts,
          opportunities,
          activities,
          metadata: {
            viewType,
            dataModel,
            recordsExtracted: totalRecords,
            extractionTimeMs: Date.now(),
            timestamp: new Date().toISOString(),
          },
        },
      });
      console.log(`[${extractionId}] Extraction saved to storage`);
    } catch (error) {
      console.error(`[${extractionId}] Error sending extraction complete:`, error);
    }

    return {
      success: true,
      data: { recordsExtracted: totalRecords },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${extractionId}] Extraction error:`, errorMessage);

    // Send error to service worker
    try {
      await chrome.runtime.sendMessage({
        action: 'EXTRACTION_ERROR',
        error: errorMessage,
      });
    } catch {
      // Ignore send errors
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function waitForOdooRender(
  extractionId: string,
  maxWaitMs: number = 3000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const odooMain = document.querySelector('.o_web_client');

    if (odooMain && (odooMain as HTMLElement).offsetHeight > 0) {
      // Wait for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`[${extractionId}] Odoo render ready in ${Date.now() - startTime}ms`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.warn(`[${extractionId}] Timeout waiting for Odoo render`);
}
