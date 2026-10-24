/**
 * Pure text helpers shared by the DOM extractors and the RPC record converters.
 * Nothing here touches the DOM or chrome APIs, so every function is unit-testable.
 */

import type { Activity } from '../shared/types';

/**
 * Generate a stable, content-based ID for records where we can't get the real Odoo ID.
 * Uses a simple hash of the content to create a deterministic ID.
 */
export function generateContentHash(prefix: string, ...parts: (string | number)[]): string {
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
 * Parses a complete_name field that may contain "company, person name" format.
 * In Odoo, when a contact has a parent company, the complete_name is formatted as:
 * "Company Name, Person Name"
 * 
 * @param completeName - The raw complete_name value from Odoo
 * @returns Object with parsed name and company, or just name if no comma present
 */
export function parseCompleteName(completeName: string): { name: string; company: string } {
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
 * Parse currency strings like "₹ 0.00" or "₹ 1,234.56" to numbers
 */
export function parseRevenue(revenueText: string): number {
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
 * Map activity type text to the Activity type union.
 * Normalizes various text representations to: 'call' | 'meeting' | 'email' | 'todo'
 */
export function mapActivityType(text: string): Activity['type'] {
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
 * Normalize a date string to ISO format (YYYY-MM-DD).
 * Handles formats like "20/01/2026" (DD/MM/YYYY) common in Odoo.
 */
export function normalizeDate(dateStr: string): string {
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

  // Handle MM-DD-YYYY format (US order with dashes)
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
export function parseRelativeDate(text: string): string {
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
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
