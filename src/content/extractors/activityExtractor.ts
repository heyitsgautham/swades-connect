import type { Activity } from '../../shared/types';
import { lookupActivityId, initializeActivityIdCacheFromStorage } from '../idCache';

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
          console.warn(`Failed to extract activity from row ${index}:`, error);
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
          console.warn(`Failed to extract activity from kanban card ${index}:`, error);
        }
      });
    }
  } catch (error) {
    console.error('Error in activity extraction:', error);
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
    console.warn('Error extracting activity from row:', error);
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
    console.warn('Error extracting activity from kanban card:', error);
    return null;
  }
}

/**
 * Map activity type text to the Activity type union.
 * Normalizes various text representations to: 'call' | 'meeting' | 'email' | 'todo'
 */
function mapActivityType(text: string): Activity['type'] {
  const normalized = text.toLowerCase().trim();

  if (normalized.includes('call') || normalized.includes('phone')) {
    return 'call';
  }
  if (normalized.includes('meet') || normalized.includes('meeting')) {
    return 'meeting';
  }
  if (normalized.includes('email') || normalized.includes('mail')) {
    return 'email';
  }
  // Default to 'todo' for "To-Do", "To Do", "task", or anything else
  return 'todo';
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
    console.warn('Error parsing due date:', error);
    return '';
  }
}

/**
 * Normalize a date string to ISO format (YYYY-MM-DD).
 * Handles formats like "20/01/2026" (DD/MM/YYYY) common in Odoo.
 */
function normalizeDate(dateStr: string): string {
  if (!dateStr) {
    return '';
  }

  // Check if already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // Handle DD/MM/YYYY format
  const ddmmyyyy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle MM/DD/YYYY format (US format)
  const mmddyyyy = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Return as-is if can't parse
  return dateStr;
}

/**
 * Parse relative date text (e.g., "In 5 days", "Today") to an actual date.
 */
function parseRelativeDate(text: string): string {
  const normalized = text.toLowerCase().trim();
  const today = new Date();

  if (normalized === 'today') {
    return formatDateISO(today);
  }

  if (normalized === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateISO(yesterday);
  }

  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateISO(tomorrow);
  }

  // Handle "In X days" pattern
  const inDaysMatch = normalized.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    return formatDateISO(futureDate);
  }

  // Handle "X days ago" pattern
  const daysAgoMatch = normalized.match(/(\d+)\s+days?\s+ago/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - days);
    return formatDateISO(pastDate);
  }

  // Return original text if can't parse
  return text;
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD).
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
