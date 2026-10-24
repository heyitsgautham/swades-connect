/**
 * Full-page extraction: walks every pager page of the current Odoo view,
 * collects records for the detected model, and reports them to the
 * service worker with EXTRACTION_COMPLETE. Also owns auto-extract,
 * which reruns extraction when the DOM watcher sees data rows change.
 */

import { setIndicatorState } from '../injected/indicator';
import { createLogger, describeError } from '../shared/logger';
import type { MessageResponse } from '../shared/messages';
import type { Activity, Contact, Opportunity } from '../shared/types';
import { isDOMWatcherActive, startDOMWatcher, stopDOMWatcher } from './domWatcher';
import { extractActivities } from './extractors/activityExtractor';
import { extractContacts } from './extractors/contactExtractor';
import { extractOpportunities } from './extractors/opportunityExtractor';
import { getAllActivityRecords, startActivityExtractionSession } from './idCache';
import { convertToActivity } from './odooRecords';
import { extractWithPagination, getCurrentPageInfo, type PaginationConfig } from './pagination';
import { detectDataModel, detectViewType } from './viewDetector';

const log = createLogger('extract');

const PAGINATION_CONFIG: PaginationConfig = {
  maxPages: 50, // Safety limit
  delayBetweenPages: 1500, // ms after each page navigation
};

let isExtracting = false;

export function isExtractionRunning(): boolean {
  return isExtracting;
}

export interface ExtractedData {
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
}

/** Activities come from the RPC records captured while paging, not the DOM. */
async function extractAllActivities(paginationConfig: PaginationConfig): Promise<Activity[]> {
  startActivityExtractionSession();

  // Paging still runs so Odoo issues a web_search_read for every page.
  await extractWithPagination<Activity>(extractActivities, paginationConfig);

  // Odoo's default activity sort is not unique, so rows shift between pages and
  // DOM extraction can miss some. The accumulated RPC records are authoritative.
  const rpcRecords = getAllActivityRecords();
  const activities: Activity[] = [];
  for (const record of rpcRecords.values()) {
    try {
      activities.push(convertToActivity(record));
    } catch (error) {
      log.error('Could not convert RPC activity record', { error: describeError(error), record });
    }
  }

  const pageInfo = getCurrentPageInfo();
  if (pageInfo && rpcRecords.size < pageInfo.total) {
    log.warn('Odoo reports more activities than were captured', {
      reported: pageInfo.total,
      captured: rpcRecords.size,
    });
  }
  return activities;
}

/** Extract every record of the model shown on the current page. */
export async function extractCurrentModel(
  dataModel: ReturnType<typeof detectDataModel>,
  paginationConfig: PaginationConfig = PAGINATION_CONFIG,
): Promise<ExtractedData> {
  const data: ExtractedData = { contacts: [], opportunities: [], activities: [] };

  if (dataModel === 'res.partner') {
    setIndicatorState('extracting', 'Extracting contacts...');
    data.contacts = await extractWithPagination<Contact>(extractContacts, paginationConfig);
  } else if (dataModel === 'crm.lead') {
    setIndicatorState('extracting', 'Extracting opportunities...');
    data.opportunities = await extractWithPagination<Opportunity>(extractOpportunities, paginationConfig);
  } else if (dataModel === 'mail.activity') {
    setIndicatorState('extracting', 'Extracting activities...');
    data.activities = await extractAllActivities(paginationConfig);
  }

  return data;
}

async function waitForOdooRender(maxWaitMs = 3000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const odooMain = document.querySelector('.o_web_client');
    if (odooMain && (odooMain as HTMLElement).offsetHeight > 0) {
      // Give dynamic content a moment to settle.
      await new Promise((resolve) => setTimeout(resolve, 500));
      log.debug('Odoo render ready', { waitedMs: Date.now() - startTime });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log.warn('Timed out waiting for Odoo to render', { maxWaitMs });
}

/**
 * Handle an extraction request. Walks every page, then sends
 * EXTRACTION_COMPLETE to the service worker, which stores the records.
 */
export async function handleExtraction(): Promise<MessageResponse> {
  if (isExtracting) {
    log.warn('Extraction already in progress, skipping');
    return { success: false, error: 'Extraction already in progress' };
  }

  isExtracting = true;

  try {
    setIndicatorState('extracting', 'Extracting...');

    const viewType = detectViewType();
    const dataModel = detectDataModel();
    log.info('Extraction started', { viewType, dataModel, total: getCurrentPageInfo()?.total });

    await waitForOdooRender();

    const { contacts, opportunities, activities } = await extractCurrentModel(dataModel);
    const totalRecords = contacts.length + opportunities.length + activities.length;

    log.info('Extraction finished', {
      contacts: contacts.length,
      opportunities: opportunities.length,
      activities: activities.length,
    });

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
      setIndicatorState('success', 'Done');
    } catch (error) {
      log.error('Could not send EXTRACTION_COMPLETE', { error: describeError(error) });
      setIndicatorState('error', 'Error');
    }

    return { success: true, data: { recordsExtracted: totalRecords } };
  } catch (error) {
    const errorMessage = describeError(error);
    log.error('Extraction failed', { error: errorMessage });
    setIndicatorState('error', 'Error');

    try {
      await chrome.runtime.sendMessage({ action: 'EXTRACTION_ERROR', error: errorMessage });
    } catch {
      // The service worker may be asleep; the error is already logged here.
    }

    return { success: false, error: errorMessage };
  } finally {
    isExtracting = false;
  }
}

/** Rerun extraction whenever the DOM watcher sees data rows change. */
export function startAutoExtract(): void {
  if (isDOMWatcherActive()) {
    log.debug('Auto-extract already active');
    return;
  }

  startDOMWatcher(async () => {
    if (isExtracting) {
      log.debug('Extraction in progress, skipping auto-extract');
      return;
    }

    const dataModel = detectDataModel();
    if (dataModel === 'unknown') {
      log.debug('Not an Odoo data page, skipping auto-extract');
      return;
    }

    log.info('Data rows changed, auto-extracting', { dataModel });
    setIndicatorState('extracting', 'Auto-extracting...');

    try {
      await handleExtraction();
    } catch (error) {
      log.error('Auto-extract failed', { error: describeError(error) });
      setIndicatorState('error', 'Auto-extract failed');
    }
  }, 5000); // 5 second debounce stops rapid-fire extractions.

  log.info('Auto-extract started');
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: 'ON' } });
  setIndicatorState('idle', 'Auto-extract ON');
}

export function stopAutoExtract(): void {
  stopDOMWatcher();
  log.info('Auto-extract stopped');
  chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', data: { text: '' } });
  setIndicatorState('idle', 'Ready');
}
