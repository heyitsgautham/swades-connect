import type { Activity } from '../../shared/types';
import { lookupActivityId, initializeActivityIdCacheFromStorage } from '../idCache';
import { generateContentHash, mapActivityType, normalizeDate, parseRelativeDate } from '../parsing';
import { createLogger, describeError } from '../../shared/logger';

const log = createLogger('extract');

/**
 * Generate an activity ID, preferring real Odoo ID from cache over content hash
 * @param rowIndex - The 0-based row index for cache lookup
 * @param fallbackParts - Parts to use for content hash if not found in cache
 * @returns Activity ID in format `act_{id}` or `act_{hash}`
 */
function generateActivityId(
  rowIndex: number,
  ...fallbackParts: (string | number)[]
): string {
  // Try to get real Odoo ID from cache using row index
  const realId = lookupActivityId(rowIndex);
  if (realId !== null) {
    return `act_${realId}`;
  }
  
  // Fall back to content hash
  return generateContentHash('act', ...fallbackParts);
}

/**
 * Main function to extract activities from the current Odoo page.
 * Handles both list and kanban views.
 * 
 * This is an async function to allow initializing the ID cache from storage
 * before extraction, addressing the timing issue where web_search_read
 * happens before the RPC interceptor is installed.
 */
export async function extractActivities(): Promise<Activity[]> {
  const activities: Activity[] = [];
  
  // Initialize activity ID cache from storage to get previously captured real IDs
  await initializeActivityIdCacheFromStorage();

  try {
    // Check for list view first
    const listRows = document.querySelectorAll('tr.o_data_row');

    if (listRows.length > 0) {
      listRows.forEach((row, index) => {
        try {
          const activity = extractActivityFromRow(row as HTMLElement, index);
          if (activity) {
            activities.push(activity);
          }
        } catch (error) {
          log.warn(`Failed to extract activity from row ${index}`, { error: describeError(error) });
        }
      });
      return activities;
    }

    // Check for kanban view
    const kanbanRecords = document.querySelectorAll('article.o_kanban_record');

    if (kanbanRecords.length > 0) {
      kanbanRecords.forEach((record, index) => {
        try {
          const activity = extractActivityFromKanbanCard(record as HTMLElement, index);
          if (activity) {
            activities.push(activity);
          }
        } catch (error) {
          log.warn(`Failed to extract activity from kanban card ${index}`, { error: describeError(error) });
        }
      });
    }
  } catch (error) {
    log.error('Error in activity extraction', { error: describeError(error) });
  }

  return activities;
}

/**
 * Extract activity data from a list view row.
 * List view structure:
 * - Row: tr.o_data_row[data-id]
 * - Summary: td[name="summary"] with data-tooltip
 * - Activity Type: td[name="activity_type_id"] with data-tooltip
 * - Assigned To: td[name="user_id"] contains avatar + name
 * - Linked Document: td[name="res_name"] with data-tooltip
 * - Due Date: td[name="date_deadline"] with div[title] for actual date
 */
function extractActivityFromRow(row: HTMLElement, index: number): Activity | null {
  try {
    // Index is used for row-based ID lookup from RPC cache

    // Extract summary from td[name="summary"]
    const summaryCell = row.querySelector('td[name="summary"]');
    const summary = summaryCell?.getAttribute('data-tooltip') ||
                    summaryCell?.textContent?.trim() || '';

    if (!summary) {
      return null;
    }

    // Extract activity type from td[name="activity_type_id"]
    const typeCell = row.querySelector('td[name="activity_type_id"]');
    const typeText = typeCell?.getAttribute('data-tooltip') ||
                     typeCell?.textContent?.trim() || '';
    const type = mapActivityType(typeText);

    // Extract assigned user from td[name="user_id"]
    const userCell = row.querySelector('td[name="user_id"]');
    const assignedTo = userCell?.getAttribute('data-tooltip') ||
                       userCell?.querySelector('.o_many2one span')?.textContent?.trim() ||
                       userCell?.textContent?.trim() || '';

    // Extract linked document name from td[name="res_name"] - available but not in Activity type yet
    // const resNameCell = row.querySelector('td[name="res_name"]');
    // const linkedDocument = resNameCell?.getAttribute('data-tooltip') ||
    //                       resNameCell?.textContent?.trim() || '';

    // Extract due date from td[name="date_deadline"]
    const dueDateCell = row.querySelector('td[name="date_deadline"]');
    const dueDate = parseDueDate(dueDateCell as HTMLElement);

    // Check status - look for indication that it's done
    const isDone = row.classList.contains('o_activity_done') ||
                   row.querySelector('.o_activity_done') !== null;
    const status: Activity['status'] = isDone ? 'done' : 'open';

    // Generate activity ID - prefer real Odoo ID from cache (using row index), fall back to content hash
    const id = generateActivityId(index, summary, type, dueDate, assignedTo);

    return {
      id,
      type,
      summary,
      dueDate,
      assignedTo,
      status,
    };
  } catch (error) {
    log.warn('Error extracting activity from row', { error: describeError(error) });
    return null;
  }
}

/**
 * Extract activity data from a kanban card.
 * Kanban view structure:
 * - Card: article.o_kanban_record[data-id]
 * - Linked Record: div.d-flex span.fw-bold (e.g., "swades-connect's opportunity")
 * - Record Type: span.text-muted (e.g., "Lead")
 * - Activity Type Badge: span.badge span (e.g., "To-Do")
 * - Summary: Second span.text-truncate in card
 * - Assigned User: footer div[name="user_id"] img and sibling
 * - Due Date: div[name="date_deadline"] with title attribute
 */
function extractActivityFromKanbanCard(card: HTMLElement, index: number): Activity | null {
  try {
    // Index is used for row-based ID lookup from RPC cache

    // Extract summary - typically the second span.text-truncate
    // In the kanban, the first truncate has the linked record, second has summary
    const textTruncates = card.querySelectorAll('span.text-truncate');
    let summary = '';
    
    // Try to find summary from direct child span.text-truncate (not inside the first div)
    const directSummary = card.querySelector(':scope > span.text-truncate');
    if (directSummary) {
      summary = directSummary.textContent?.trim() || '';
    } else if (textTruncates.length > 1) {
      summary = textTruncates[1]?.textContent?.trim() || '';
    } else if (textTruncates.length === 1) {
      summary = textTruncates[0]?.textContent?.trim() || '';
    }

    // Fallback: try to get linked record name as summary
    if (!summary) {
      const linkedRecord = card.querySelector('span.fw-bold');
      summary = linkedRecord?.textContent?.trim() || '';
    }

    if (!summary) {
      return null;
    }

    // Extract activity type from badge
    const typeBadge = card.querySelector('span.badge span');
    const typeText = typeBadge?.textContent?.trim() || '';
    const type = mapActivityType(typeText);

    // Extract assigned user from footer with multiple fallback strategies
    const userElement = card.querySelector('footer div[name="user_id"]');
    let assignedTo = '';
    
    if (userElement) {
      // Try to get from image attributes (title, alt, or data attributes)
      const userImg = userElement.querySelector('img');
      if (userImg) {
        assignedTo = userImg.getAttribute('title') ||
                     userImg.getAttribute('alt') ||
                     userImg.getAttribute('data-tooltip') || '';
      }
      
      // Fallback: look for text in span elements
      if (!assignedTo) {
        const textSpan = userElement.querySelector('span.text-truncate') ||
                        userElement.querySelector('span');
        assignedTo = textSpan?.textContent?.trim() || '';
      }
      
      // Last resort: get all text content
      if (!assignedTo) {
        assignedTo = userElement.textContent?.trim() || '';
      }
    }

    // Extract linked document name for reference - available but not in Activity type yet
    // const linkedRecord = card.querySelector('span.fw-bold');
    // const linkedDocument = linkedRecord?.textContent?.trim() || '';

    // Extract due date
    const dueDateElement = card.querySelector('div[name="date_deadline"]');
    const dueDate = parseDueDate(dueDateElement as HTMLElement);

    // Check status - look for indication that it's done
    const isDone = card.classList.contains('o_activity_done') ||
                   card.querySelector('.o_activity_done') !== null;
    const status: Activity['status'] = isDone ? 'done' : 'open';

    // Generate activity ID - prefer real Odoo ID from cache (using row index), fall back to content hash
    const id = generateActivityId(index, summary, type, dueDate, assignedTo);

    return {
      id,
      type,
      summary,
      dueDate,
      assignedTo,
      status,
    };
  } catch (error) {
    log.warn('Error extracting activity from kanban card', { error: describeError(error) });
    return null;
  }
}

/**
 * Parse due date from an Odoo date element.
 * Handles:
 * - title attribute with actual date (e.g., "20/01/2026")
 * - Relative text like "In 5 days", "Today", "Yesterday"
 */
function parseDueDate(element: HTMLElement | null): string {
  if (!element) {
    return '';
  }

  try {
    // First, try to get the actual date from title attribute
    // The inner div typically has the title with the formatted date
    const innerDiv = element.querySelector('div[title]');
    if (innerDiv) {
      const titleDate = innerDiv.getAttribute('title');
      if (titleDate) {
        return normalizeDate(titleDate);
      }
    }

    // Check if the element itself has a title
    const elementTitle = element.getAttribute('title');
    if (elementTitle) {
      return normalizeDate(elementTitle);
    }

    // Fallback: parse relative date text
    const textContent = element.textContent?.trim() || '';
    return parseRelativeDate(textContent);
  } catch (error) {
    log.warn('Error parsing due date', { error: describeError(error) });
    return '';
  }
}
