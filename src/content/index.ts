import { extractContacts } from './extractors/contactExtractor';
import { extractOpportunities } from './extractors/opportunityExtractor';
import { extractActivities } from './extractors/activityExtractor';
import { detectViewType, detectDataModel } from './viewDetector';
import { mountIndicator, setIndicatorState } from '../injected/indicator';
import { extractWithPagination, getCurrentPageInfo } from './pagination';
import { startDOMWatcher, stopDOMWatcher, isDOMWatcherActive } from './domWatcher';
import {
  injectRpcInterceptor,
  setupRpcSignalListener,
  type OdooRpcSignal
} from '../injected/rpcInterceptor';
import type { ExtensionMessage, MessageResponse, DataType } from '../shared/messages';
import type { Contact, Opportunity, Activity } from '../shared/types';
import {
  populateOpportunityIdCache,
  setOpportunityId,
  populateActivityIdCache,
  setActivityId,
  getActivityIdCacheSize,
  getOpportunityIdCacheSize,
  startActivityExtractionSession,
  getAllActivityRecords
} from './idCache';

// Pagination configuration
const PAGINATION_CONFIG = {
  maxPages: 50,           // Safety limit - max pages to extract
  delayBetweenPages: 1500, // Delay between page navigations (ms)
};

// RPC sync state
let rpcSyncEnabled = false;
let rpcCleanupFn: (() => void) | null = null;

console.log('[Swades Connect] Content script loaded on:', window.location.href);

// Expose cache size function for pagination synchronization
// This allows pagination.ts to poll for cache updates without circular dependencies
(window as any).__swadesCacheSize = () => {
  return getActivityIdCacheSize() + getOpportunityIdCacheSize();
};

// Inject RPC interceptor IMMEDIATELY (before Odoo loads data)
// This must happen at document_start to capture web_search_read calls
injectRpcInterceptor();
console.log('[Swades Connect] RPC interceptor injected');

// Mount the Shadow DOM indicator when DOM is ready
// At document_start, we need to wait for body to exist
function mountIndicatorWhenReady() {
  if (document.body) {
    mountIndicator();
    console.log('[Swades Connect] Status indicator mounted');
  } else {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      mountIndicator();
      console.log('[Swades Connect] Status indicator mounted (after DOMContentLoaded)');
    });
  }
}
mountIndicatorWhenReady();

// Initialize settings from storage
chrome.storage.local.get(['auto_extract_enabled', 'rpc_sync_enabled'], (result) => {
  if (result.auto_extract_enabled) {
    startAutoExtract();
  }
  if (result.rpc_sync_enabled) {
    startRpcSync();
  }
});

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

    if (message.action === 'TOGGLE_AUTO_EXTRACT') {
      const enabled = (message as unknown as { enabled: boolean }).enabled;

      if (enabled) {
        startAutoExtract();
        sendResponse({ success: true, data: { enabled: true } });
      } else {
        stopAutoExtract();
        sendResponse({ success: true, data: { enabled: false } });
      }

      return true;
    }

    if (message.action === 'TOGGLE_RPC_SYNC') {
      const enabled = (message as unknown as { enabled: boolean }).enabled;

      if (enabled) {
        startRpcSync();
        sendResponse({ success: true, data: { enabled: true } });
      } else {
        stopRpcSync();
        sendResponse({ success: true, data: { enabled: false } });
      }

      return true;
    }

    // Return false for messages we don't handle
    return false;
  }
);

/**
 * Handle extraction request - returns Promise<MessageResponse>
 * Uses pagination to extract ALL records across multiple Odoo pages
 */
async function handleExtraction(): Promise<MessageResponse> {
  const extractionId = `extraction_${Date.now()}`;

  // Prevent concurrent extractions
  if (isExtracting) {
    console.warn(`[${extractionId}] Extraction already in progress, skipping`);
    return { success: false, error: 'Extraction already in progress' };
  }

  isExtracting = true;

  try {
    console.log(`[${extractionId}] Starting extraction with pagination...`);

    // Get initial page info for logging
    const pageInfo = getCurrentPageInfo();
    if (pageInfo) {
      console.log(`[${extractionId}] Found ${pageInfo.total} total records to extract`);
    }

    // Update indicator to extracting state
    setIndicatorState('extracting', 'Extracting...');

    // Detect current context
    const viewType = detectViewType();
    const dataModel = detectDataModel();

    console.log(`[${extractionId}] View: ${viewType}, Model: ${dataModel}`);

    // Wait for Odoo to render
    await waitForOdooRender(extractionId);

    // Extract based on model - using pagination to get ALL pages
    let contacts: Contact[] = [];
    let opportunities: Opportunity[] = [];
    let activities: Activity[] = [];

    if (dataModel === 'res.partner') {
      setIndicatorState('extracting', 'Extracting contacts...');
      contacts = await extractWithPagination<Contact>(
        extractContacts,
        PAGINATION_CONFIG
      );
    } else if (dataModel === 'crm.lead') {
      setIndicatorState('extracting', 'Extracting opportunities...');
      opportunities = await extractWithPagination<Opportunity>(
        extractOpportunities,
        PAGINATION_CONFIG
      );
    } else if (dataModel === 'mail.activity') {
      setIndicatorState('extracting', 'Extracting activities...');
      // Start a new extraction session to track all unique records seen via RPC
      startActivityExtractionSession();

      // Navigate through all pages to trigger RPC calls and collect data
      // We still do pagination to trigger Odoo's RPC calls for each page
      await extractWithPagination<Activity>(
        extractActivities,
        PAGINATION_CONFIG
      );

      // Get all RPC data accumulated during pagination - this is our authoritative source
      const allRpcRecords = getAllActivityRecords();

      // Convert ALL RPC records to Activity objects (bypass DOM extraction entirely)
      // This avoids the Odoo pagination instability where records shift between pages
      activities = [];
      for (const [, rpcRecord] of allRpcRecords) {
        const activity = convertRpcRecordToActivity(rpcRecord);
        if (activity) {
          activities.push(activity);
        }
      }

      // If RPC count doesn't match Odoo's total, log a warning
      // This indicates Odoo's pagination lost some records between pages
      const pageInfo = getCurrentPageInfo();
      if (pageInfo && allRpcRecords.size < pageInfo.total) {
        console.warn(`[Swades Connect] Odoo reports ${pageInfo.total} activities but extracted ${allRpcRecords.size}`);
      }
    }

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

      // Update indicator to success state
      setIndicatorState('success', 'Done');
    } catch (error) {
      console.error(`[${extractionId}] Error sending extraction complete:`, error);
      setIndicatorState('error', 'Error');
    }

    return {
      success: true,
      data: { recordsExtracted: totalRecords },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${extractionId}] Extraction error:`, errorMessage);

    // Update indicator to error state
    setIndicatorState('error', 'Error');

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
  } finally {
    // Always reset the flag
    isExtracting = false;
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

// Track if extraction is in progress to prevent overlapping extractions
let isExtracting = false;

/**
 * Start auto-extraction on DOM changes
 */
function startAutoExtract(): void {
  if (isDOMWatcherActive()) {
    console.log('[Swades Connect] Auto-extract already active');
    return;
  }

  console.log('[Swades Connect] Starting auto-extract...');

  startDOMWatcher(async () => {
    // Prevent overlapping extractions
    if (isExtracting) {
      console.log('[Swades Connect] Extraction already in progress, skipping auto-extract');
      return;
    }

    // Only auto-extract on Odoo pages
    const dataModel = detectDataModel();
    if (!dataModel || dataModel === 'unknown') {
      console.log('[Swades Connect] Not an Odoo data page, skipping auto-extract');
      return;
    }

    console.log('[Swades Connect] DOM change detected (actual data change), auto-extracting...');
    setIndicatorState('extracting', 'Auto-extracting...');

    try {
      await handleExtraction();
    } catch (error) {
      console.error('[Swades Connect] Auto-extract error:', error);
      setIndicatorState('error', 'Auto-extract failed');
    }
  }, 5000); // 5 second debounce for auto-extract - prevents rapid-fire extractions

  // Update badge
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: 'ON' } });
  setIndicatorState('idle', 'Auto-extract ON');
}

/**
 * Stop auto-extraction
 */
function stopAutoExtract(): void {
  console.log('[Swades Connect] Stopping auto-extract...');
  stopDOMWatcher();

  // Clear badge
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: '' } });
  setIndicatorState('idle', 'Ready');
}

// ============================================================================
// RPC-Based Real-Time Sync
// ============================================================================

/**
 * Map Odoo model names to our extension data types
 * mail.activity.schedule is the wizard model used for creating new activities
 */
function mapModelToDataType(model: string): DataType | null {
  switch (model) {
    case 'res.partner':
      return 'contacts';
    case 'crm.lead':
      return 'opportunities';
    case 'mail.activity':
    case 'mail.activity.schedule':
      return 'activities';
    default:
      return null;
  }
}

/**
 * Convert Odoo's false values to appropriate defaults
 * Odoo uses `false` instead of `null` for empty values
 */
function sanitizeOdooValue<T>(value: unknown, defaultValue: T): T {
  if (value === false || value === null || value === undefined) {
    return defaultValue;
  }
  return value as T;
}

/**
 * Extract display name from a Many2one field which can be:
 * - false (not set)
 * - [id, "Display Name"] tuple
 * - { id: number, display_name: string } object
 * - string (already the name)
 */
function extractMany2oneName(value: unknown): string {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) && value.length >= 2) {
    return String(value[1]);
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.display_name) return String(obj.display_name);
    if (obj.name) return String(obj.name);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/**
 * Parses a complete_name field that may contain "company, person name" format.
 * In Odoo, when a contact has a parent company, the complete_name is formatted as:
 * "Company Name, Person Name"
 */
function parseCompleteName(completeName: string): { name: string; company: string } {
  if (!completeName) {
    return { name: '', company: '' };
  }

  // Check if the name contains a comma (indicating "company, person" format)
  const commaIndex = completeName.indexOf(',');
  
  if (commaIndex !== -1) {
    // Format: "Company Name, Person Name"
    const companyPart = completeName.substring(0, commaIndex).trim();
    const personPart = completeName.substring(commaIndex + 1).trim();
    
    // Only use this parsing if both parts are non-empty
    if (companyPart && personPart) {
      return {
        name: personPart,
        company: companyPart,
      };
    }
  }

  // No comma or invalid format - return the whole string as name
  return { name: completeName.trim(), company: '' };
}

/**
 * Convert an Odoo res.partner record to our Contact format
 * Uses `contact_{id}` format to match the DOM extractor
 */
function convertToContact(record: Record<string, unknown>): Contact {
  const odooId = sanitizeOdooValue(record.id, '');

  // Start with explicit name fields
  let name = sanitizeOdooValue(record.name, '') as string ||
    sanitizeOdooValue(record.display_name, '') as string;
  
  // Company: can be 'company_name' (string), 'parent_id' (Many2one tuple), or 'parent_name'
  let company = sanitizeOdooValue(record.company_name, '') as string;
  if (!company) {
    company = extractMany2oneName(record.parent_id);
  }
  if (!company) {
    company = sanitizeOdooValue(record.parent_name, '') as string;
  }

  // If no explicit name, parse complete_name which may be "company, person" format
  if (!name) {
    const completeName = sanitizeOdooValue(record.complete_name, '') as string;
    if (completeName) {
      const parsed = parseCompleteName(completeName);
      name = parsed.name;
      // Use parsed company if we don't have one from explicit fields
      if (!company && parsed.company) {
        company = parsed.company;
      }
    }
  }

  // Country: country_id is a Many2one field [id, "Name"] or {id, display_name}
  const country = extractMany2oneName(record.country_id);

  return {
    id: `contact_${odooId}`,
    name,
    email: sanitizeOdooValue(record.email, '') as string,
    phone: sanitizeOdooValue(record.phone, sanitizeOdooValue(record.mobile, '')) as string,
    company,
    country,
  };
}

/**
 * Convert an Odoo crm.lead record to our Opportunity format
 * Uses `opp_{id}` format to be consistent with contacts
 * 
 * Handles both:
 * - Additions: data from args[1] with fields like name, expected_revenue, stage_id (as number)
 * - Edits: full response with fields like stage_id as { id, display_name } or [id, name]
 */
function convertToOpportunity(record: Record<string, unknown>): Opportunity {
  const odooId = sanitizeOdooValue(record.id, '');

  // Stage can be:
  // - A tuple [id, name] (from some responses)
  // - An object { id, display_name } (from edit responses)
  // - Just a number (from addition args)
  // - A string (already the name)
  let stageName = '';
  const stageValue = record.stage_id;
  if (Array.isArray(stageValue) && stageValue.length >= 2) {
    stageName = String(stageValue[1]);
  } else if (typeof stageValue === 'object' && stageValue !== null) {
    const stageObj = stageValue as Record<string, unknown>;
    stageName = (stageObj.display_name || stageObj.name || '') as string;
  } else if (typeof stageValue === 'string') {
    stageName = stageValue;
  } else if (typeof stageValue === 'number') {
    // For additions, we might only get the stage ID - set a placeholder
    stageName = `Stage ${stageValue}`;
  }

  // Revenue: can be expected_revenue or revenue
  const revenue = sanitizeOdooValue(
    record.expected_revenue ?? record.revenue,
    0
  ) as number;

  // Probability: defaults to 0 for new opportunities
  const probability = sanitizeOdooValue(record.probability, 0) as number;

  // Close date: can be date_deadline or closeDate
  const closeDate = sanitizeOdooValue(
    record.date_deadline ?? record.closeDate,
    ''
  ) as string;

  return {
    id: `opp_${odooId}`,
    name: sanitizeOdooValue(record.name, '') as string,
    revenue,
    stage: stageName,
    probability,
    closeDate,
  };
}

/**
 * Convert an Odoo mail.activity or mail.activity.schedule record to our Activity format
 * Uses `act_{id}` format to be consistent with other types
 * 
 * For additions (mail.activity.schedule/web_save): uses activity_user_id, activity_type_id
 * For edits (mail.activity/web_save): uses user_id, activity_type_id
 * For RPC web_search_read: uses user_id, activity_type_id with object format
 */
function convertToActivity(record: Record<string, unknown>): Activity {
  const odooId = sanitizeOdooValue(record.id, '');

  // Activity type can be a tuple [id, name] or { id, display_name }
  let typeName = 'todo';
  const activityType = record.activity_type_id;
  if (activityType) {
    let typeLabel = '';
    if (Array.isArray(activityType)) {
      typeLabel = (activityType[1] as string).toLowerCase();
    } else if (typeof activityType === 'object' && activityType !== null) {
      const typeObj = activityType as Record<string, unknown>;
      typeLabel = ((typeObj.display_name || typeObj.name || '') as string).toLowerCase();
    }
    if (typeLabel.includes('call')) typeName = 'call';
    else if (typeLabel.includes('meeting')) typeName = 'meeting';
    else if (typeLabel.includes('email')) typeName = 'email';
  }

  // Assigned user: check activity_user_id (for additions) then user_id (for edits/RPC)
  // Both can be a tuple [id, name] or { id, display_name }
  let assignedTo = '';
  const activityUserId = record.activity_user_id || record.user_id;
  if (activityUserId) {
    if (Array.isArray(activityUserId)) {
      assignedTo = activityUserId[1] as string;
    } else if (typeof activityUserId === 'object' && activityUserId !== null) {
      const userObj = activityUserId as Record<string, unknown>;
      assignedTo = (userObj.display_name || userObj.name || '') as string;
    }
  }

  return {
    id: `act_${odooId}`,
    type: typeName as Activity['type'],
    summary: sanitizeOdooValue(record.summary, sanitizeOdooValue(record.note, '')) as string,
    dueDate: sanitizeOdooValue(record.date_deadline, '') as string,
    assignedTo,
    status: record.state === 'done' ? 'done' : 'open',
  };
}

/**
 * Convert an RPC record to Activity format.
 * This is a wrapper that handles the specific fields from web_search_read responses.
 * Returns null if conversion fails.
 */
function convertRpcRecordToActivity(record: Record<string, unknown>): Activity | null {
  try {
    return convertToActivity(record);
  } catch (error) {
    console.error('[Swades Connect] Error converting RPC record to activity:', error, record);
    return null;
  }
}

/**
 * Convert Odoo record to extension format based on data type
 */
function convertRecord(dataType: DataType, record: Record<string, unknown>): Contact | Opportunity | Activity | null {
  try {
    switch (dataType) {
      case 'contacts':
        return convertToContact(record);
      case 'opportunities':
        return convertToOpportunity(record);
      case 'activities':
        return convertToActivity(record);
      default:
        return null;
    }
  } catch (error) {
    console.error('[Swades Connect] Error converting record:', error);
    return null;
  }
}

/**
 * Handle an RPC signal from the interceptor
 */
function handleRpcSignal(signal: OdooRpcSignal): void {
  const { payload } = signal;
  const { model, method, args, result } = payload;

  console.log(`[Swades Connect] RPC Signal: ${model}.${method}`, { args, result });

  const dataType = mapModelToDataType(model);
  if (!dataType) {
    console.warn(`[Swades Connect] Unknown model: ${model}`);
    return;
  }

  // Update indicator to show sync activity
  setIndicatorState('extracting', 'Syncing...');

  try {
    switch (method) {
      case 'web_search_read': {
        // web_search_read is used when Odoo loads list views
        // We use it to capture real Odoo IDs and auto-populate storage
        // Response format: { length: N, records: [...], __domain: [...] }
        if (typeof result === 'object' && result !== null) {
          const resultObj = result as Record<string, unknown>;
          const records = resultObj.records as Array<Record<string, unknown>> | undefined;

          if (Array.isArray(records) && records.length > 0) {
            if (model === 'res.partner') {
              // Auto-populate contacts from web_search_read
              const contacts: Contact[] = [];
              for (const rec of records) {
                const converted = convertRecord('contacts', rec);
                if (converted) contacts.push(converted as Contact);
              }
              if (contacts.length > 0) {
                chrome.runtime.sendMessage({
                  action: 'ODOO_RPC_UPSERT',
                  data: { type: 'contacts', records: contacts },
                }).catch((error) => {
                  console.error('[Swades Connect] Failed to upsert contacts from web_search_read:', error);
                });
              }
            } else if (model === 'crm.lead') {
              populateOpportunityIdCache(records);
              // Auto-populate opportunities from web_search_read
              const opportunities: Opportunity[] = [];
              for (const rec of records) {
                const converted = convertRecord('opportunities', rec);
                if (converted) opportunities.push(converted as Opportunity);
              }
              if (opportunities.length > 0) {
                chrome.runtime.sendMessage({
                  action: 'ODOO_RPC_UPSERT',
                  data: { type: 'opportunities', records: opportunities },
                }).catch((error) => {
                  console.error('[Swades Connect] Failed to upsert opportunities from web_search_read:', error);
                });
              }
            } else if (model === 'mail.activity') {
              populateActivityIdCache(records);
              // Auto-populate activities from web_search_read
              const activities: Activity[] = [];
              for (const rec of records) {
                const converted = convertRecord('activities', rec);
                if (converted) activities.push(converted as Activity);
              }
              if (activities.length > 0) {
                chrome.runtime.sendMessage({
                  action: 'ODOO_RPC_UPSERT',
                  data: { type: 'activities', records: activities },
                }).catch((error) => {
                  console.error('[Swades Connect] Failed to upsert activities from web_search_read:', error);
                });
              }
            }
          }
        }
        // Don't update indicator for read operations
        setIndicatorState('idle', rpcSyncEnabled ? 'RPC sync ON' : 'Ready');
        return;
      }

      case 'web_read_group': {
        // web_read_group is used when Odoo loads kanban views with grouping (e.g., opportunities by stage)
        // Response format: { groups: [{ stage_id: [...], __records: [{id, name, ...}, ...] }, ...], length: N }
        if (model === 'crm.lead' && typeof result === 'object' && result !== null) {
          const resultObj = result as Record<string, unknown>;
          const groups = resultObj.groups as Array<Record<string, unknown>> | undefined;

          if (Array.isArray(groups)) {
            // Collect all records from all groups
            const allRecords: Array<Record<string, unknown>> = [];
            for (const group of groups) {
              const records = group.__records as Array<Record<string, unknown>> | undefined;
              if (Array.isArray(records)) {
                allRecords.push(...records);
              }
            }

            if (allRecords.length > 0) {
              populateOpportunityIdCache(allRecords);
              // Auto-populate opportunities from web_read_group (kanban view)
              const opportunities: Opportunity[] = [];
              for (const rec of allRecords) {
                const converted = convertRecord('opportunities', rec);
                if (converted) opportunities.push(converted as Opportunity);
              }
              if (opportunities.length > 0) {
                chrome.runtime.sendMessage({
                  action: 'ODOO_RPC_UPSERT',
                  data: { type: 'opportunities', records: opportunities },
                }).catch((error) => {
                  console.error('[Swades Connect] Failed to upsert opportunities from web_read_group:', error);
                });
              }
            }
          }
        }
        // Don't update indicator for read operations
        setIndicatorState('idle', rpcSyncEnabled ? 'RPC sync ON' : 'Ready');
        return;
      }

      case 'unlink':
      case 'action_done': {
        // unlink: args[0] is the array of IDs to delete
        // action_done: args[0] is also the array of activity IDs being marked as done
        // Both methods effectively remove the activity from the active list
        // We need to prefix the IDs to match the format used by extractors
        const prefix = dataType === 'contacts' ? 'contact_' : dataType === 'opportunities' ? 'opp_' : 'act_';
        const ids = (args[0] as number[]).map(id => `${prefix}${id}`);
        console.log(`[Swades Connect] RPC DELETE (${method}): ${dataType}`, ids);

        chrome.runtime.sendMessage({
          action: 'ODOO_RPC_DELETE',
          data: { type: dataType, ids },
        }).then(() => {
          setIndicatorState('success', method === 'action_done' ? 'Marked Done' : 'Deleted');
        }).catch((error) => {
          console.error('[Swades Connect] RPC delete message failed:', error);
          setIndicatorState('error', 'Sync failed');
        });
        break;
      }

      case 'name_create': {
        // name_create: Used for quick contact creation (e.g., from opportunity forms)
        // args[0] is the name string
        // result is a tuple [id, display_name]
        if (model !== 'res.partner') {
          console.log(`[Swades Connect] name_create not supported for model: ${model}`);
          setIndicatorState('idle', 'Ready');
          return;
        }

        if (Array.isArray(result) && result.length >= 2) {
          const [id, displayName] = result as [number, string];
          const nameArg = typeof args[0] === 'string' ? args[0] : displayName;

          const contact: Contact = {
            id: `contact_${id}`,
            name: nameArg,
            email: '',  // name_create doesn't set email
            phone: '',  // name_create doesn't set phone
            company: '',
            country: '',
          };

          console.log(`[Swades Connect] RPC name_create: Created contact`, contact);

          chrome.runtime.sendMessage({
            action: 'ODOO_RPC_UPSERT',
            data: { type: 'contacts', records: [contact] },
          }).then(() => {
            setIndicatorState('success', 'Contact Created');
          }).catch((error) => {
            console.error('[Swades Connect] RPC upsert message failed:', error);
            setIndicatorState('error', 'Sync failed');
          });
        } else {
          console.warn('[Swades Connect] Unexpected name_create result format:', result);
          setIndicatorState('idle', 'Ready');
        }
        break;
      }

      case 'create':
      case 'web_save': {
        // Handle opportunity additions and edits
        // web_save for crm.lead:
        //   - Addition: args[0] = [] (empty array), args[1] = { field: value, ... }
        //     Response: [{ id: xxx }] (only ID returned)
        //   - Edit: args[0] = [id] (array with ID), args[1] = { changed fields }
        //     Response: [{ full record with all fields }]

        // CRITICAL: Skip mail.activity.schedule (activity creation wizard)
        // The wizard returns its OWN ID (e.g., 18), NOT the actual mail.activity ID (e.g., 376)
        // This causes duplicates: create stores act_18, edit comes with act_376
        // Solution: Skip wizard, let the web_search_read that follows capture the real ID
        if (model === 'mail.activity.schedule') {
          console.log('[Swades Connect] Skipping mail.activity.schedule wizard - real ID will come from web_search_read');
          setIndicatorState('success', 'Activity Created');
          return;
        }

        const records: (Contact | Opportunity | Activity)[] = [];
        const idsArray = args[0] as unknown[];
        const isAddition = Array.isArray(idsArray) && idsArray.length === 0;

        // Check if result contains full record data or just ID
        const firstResult = Array.isArray(result) && result[0] ? result[0] : result;
        const resultKeys = typeof firstResult === 'object' && firstResult !== null
          ? Object.keys(firstResult as object)
          : [];
        const hasOnlyId = resultKeys.length === 1 && resultKeys[0] === 'id';

        if (hasOnlyId && args.length >= 2) {
          // Result only has ID - merge with args[1] (the field data)
          // This happens for:
          //   1. Additions: args[0]=[], args[1]={all fields}, result=[{id: x}]
          //   2. Some edits: args[0]=[id], args[1]={changed fields}, result=[{id: x}]
          const fieldData = args[1] as Record<string, unknown>;

          if (Array.isArray(result)) {
            for (const res of result) {
              if (typeof res === 'object' && res !== null && 'id' in (res as object)) {
                const id = (res as { id: number }).id;
                // Construct record from ID + field data from args
                const recordData: Record<string, unknown> = {
                  id,
                  ...fieldData,
                };

                // Cache opportunity name→id for future DOM extractions
                if (dataType === 'opportunities' && typeof fieldData.name === 'string') {
                  setOpportunityId(fieldData.name, id);
                }

                // Cache activity summary→id for future DOM extractions
                if (dataType === 'activities' && typeof fieldData.summary === 'string') {
                  setActivityId(fieldData.summary, id);
                }

                const converted = convertRecord(dataType, recordData);
                if (converted) records.push(converted);
              }
            }
          }
        } else if (Array.isArray(result)) {
          // Result is array of full records (typical for edits with full response)
          for (const rec of result) {
            if (typeof rec === 'object' && rec !== null) {
              const recObj = rec as Record<string, unknown>;

              // Cache opportunity name→id for future DOM extractions
              if (dataType === 'opportunities' && typeof recObj.id === 'number' && typeof recObj.name === 'string') {
                setOpportunityId(recObj.name, recObj.id);
              }

              // Cache activity summary→id for future DOM extractions
              if (dataType === 'activities' && typeof recObj.id === 'number' && typeof recObj.summary === 'string') {
                setActivityId(recObj.summary, recObj.id);
              }

              const converted = convertRecord(dataType, recObj);
              if (converted) records.push(converted);
            }
          }
        } else if (typeof result === 'object' && result !== null) {
          // Result is a single full record
          const resObj = result as Record<string, unknown>;

          // Cache opportunity name→id for future DOM extractions
          if (dataType === 'opportunities' && typeof resObj.id === 'number' && typeof resObj.name === 'string') {
            setOpportunityId(resObj.name, resObj.id);
          }

          // Cache activity summary→id for future DOM extractions
          if (dataType === 'activities' && typeof resObj.id === 'number' && typeof resObj.summary === 'string') {
            setActivityId(resObj.summary, resObj.id);
          }

          const converted = convertRecord(dataType, resObj);
          if (converted) records.push(converted);
        } else if (typeof result === 'number') {
          // create sometimes returns just the ID
          setIndicatorState('idle', 'Ready');
          return;
        }

        if (records.length > 0) {
          console.log(`[Swades Connect] RPC ${isAddition ? 'CREATE' : 'UPSERT'}: ${records.length} ${dataType}`);

          chrome.runtime.sendMessage({
            action: 'ODOO_RPC_UPSERT',
            data: { type: dataType, records },
          }).then(() => {
            setIndicatorState('success', isAddition ? 'Added' : 'Synced');
          }).catch((error) => {
            console.error('[Swades Connect] RPC upsert message failed:', error);
            setIndicatorState('error', 'Sync failed');
          });
        } else {
          setIndicatorState('idle', 'Ready');
        }
        break;
      }

      case 'write': {
        // write: args[0] is IDs, args[1] is values to update
        // result is usually just `true` if successful
        // The actual updated record often comes in a subsequent web_save or read call
        // For now, just log and let web_save handle the full update
        console.log(`[Swades Connect] RPC write detected, waiting for web_save...`);
        setIndicatorState('idle', 'Ready');
        break;
      }

      default:
        console.log(`[Swades Connect] Unhandled RPC method: ${method}`);
        setIndicatorState('idle', 'Ready');
    }
  } catch (error) {
    console.error('[Swades Connect] Error handling RPC signal:', error);
    setIndicatorState('error', 'Sync error');
  }
}

/**
 * Start RPC-based real-time sync
 */
function startRpcSync(): void {
  if (rpcSyncEnabled) {
    console.log('[Swades Connect] RPC sync already active');
    return;
  }

  console.log('[Swades Connect] Starting RPC sync...');

  // Setup the RPC signal listener
  rpcCleanupFn = setupRpcSignalListener(handleRpcSignal);
  rpcSyncEnabled = true;

  // Persist setting
  chrome.storage.local.set({ rpc_sync_enabled: true });

  // Update badge and indicator
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: 'RPC' } });
  setIndicatorState('idle', 'RPC sync ON');
}

/**
 * Stop RPC-based real-time sync
 */
function stopRpcSync(): void {
  if (!rpcSyncEnabled) {
    console.log('[Swades Connect] RPC sync not active');
    return;
  }

  console.log('[Swades Connect] Stopping RPC sync...');

  // Cleanup listener
  if (rpcCleanupFn) {
    rpcCleanupFn();
    rpcCleanupFn = null;
  }
  rpcSyncEnabled = false;

  // Persist setting
  chrome.storage.local.set({ rpc_sync_enabled: false });

  // Clear badge and update indicator
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: '' } });
  setIndicatorState('idle', 'Ready');
}
