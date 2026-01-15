import type { Contact } from '../../shared/types';

/**
 * Extracts contacts from both Odoo list and kanban views.
 * Automatically detects the view type and uses the appropriate extraction method.
 */
export function extractContacts(): Contact[] {
  const contacts: Contact[] = [];

  try {
    // Check for list view first
    const listRows = document.querySelectorAll('tr.o_data_row');

    if (listRows.length > 0) {
      listRows.forEach((row, index) => {
        try {
          const contact = extractContactFromRow(row as HTMLElement, index);
          if (contact) {
            contacts.push(contact);
          }
        } catch (error) {
          console.warn(`Failed to extract contact from row ${index}:`, error);
        }
      });
      return contacts;
    }

    // Check for kanban view
    const kanbanCards = document.querySelectorAll('article.o_kanban_record');

    if (kanbanCards.length > 0) {
      kanbanCards.forEach((card, index) => {
        try {
          const contact = extractContactFromKanbanCard(card as HTMLElement, index);
          if (contact) {
            contacts.push(contact);
          }
        } catch (error) {
          console.warn(`Failed to extract contact from kanban card ${index}:`, error);
        }
      });
      return contacts;
    }

    console.warn('No contacts found in list or kanban view');
  } catch (error) {
    console.error('Error in contact extraction:', error);
  }

  return contacts;
}

/**
 * Extracts a contact from a list view row.
 * Uses data-tooltip attributes for clean text values.
 */
function extractContactFromRow(row: HTMLElement, index: number): Contact | null {
  try {
    // Get record ID from data-id attribute
    const id = row.getAttribute('data-id') || `contact_${index}`;

    // Extract name from td[name="complete_name"] using data-tooltip
    const nameCell = row.querySelector('td[name="complete_name"]');
    const name = getTooltipOrText(nameCell);

    if (!name) {
      return null;
    }

    // Extract email from td[name="email"] using data-tooltip
    const emailCell = row.querySelector('td[name="email"]');
    const email = getTooltipOrText(emailCell);

    // Extract phone from td[name="phone"] using data-tooltip
    const phoneCell = row.querySelector('td[name="phone"]');
    const phone = getTooltipOrText(phoneCell);

    // Extract company - try parent_id first, then company_name
    const companyCell =
      row.querySelector('td[name="parent_id"]') ||
      row.querySelector('td[name="company_name"]');
    const company = getTooltipOrText(companyCell);

    // Extract country as fallback info (stored in salesperson for now)
    const countryCell = row.querySelector('td[name="country_id"]');
    const country = getTooltipOrText(countryCell);

    // Try to extract salesperson if available
    const salespersonCell = row.querySelector('td[name="user_id"]');
    const salesperson = getTooltipOrText(salespersonCell) || country;

    return {
      id,
      name,
      email: email || '',
      phone: phone || '',
      company: company || '',
      salesperson: salesperson || '',
    };
  } catch (error) {
    console.warn('Error extracting contact from row:', error);
    return null;
  }
}

/**
 * Extracts a contact from a kanban card.
 * Uses icon siblings to identify email and phone fields.
 */
function extractContactFromKanbanCard(card: HTMLElement, index: number): Contact | null {
  try {
    // Get record ID from data-id attribute
    const id = card.getAttribute('data-id') || `contact_${index}`;

    // Extract name: Use flexible selector that matches Odoo v19 kanban structure
    // Odoo typically uses: <main><div class="mb-1"><span class="mb-0 fw-bold fs-5">Name</span></div></main>
    const nameElement =
      card.querySelector('main span.fw-bold.fs-5') ||
      card.querySelector('main .mb-1 span.fw-bold') ||
      card.querySelector('.o_kanban_record_title') ||
      card.querySelector('main span.fw-bold') ||
      card.querySelector('.fw-bold');

    const name = nameElement?.textContent?.trim() || '';

    if (!name) {
      return null;
    }

    // Extract email: look for fa-envelope icon and get sibling span
    const email = extractFieldByIcon(card, 'fa-envelope');

    // Extract phone: look for fa-phone icon and get sibling span
    const phone = extractFieldByIcon(card, 'fa-phone');

    // Extract location/country: look for fa-map-marker icon
    const contactLocation = extractFieldByIcon(card, 'fa-map-marker');

    // Extract company: look for company-related content
    const company = extractCompanyFromKanban(card);

    // Extract salesperson if available
    const salesperson = extractSalespersonFromKanban(card);

    return {
      id,
      name,
      email: email || '',
      phone: phone || '',
      company: company || contactLocation, // Use location as company fallback if no explicit company
      salesperson: salesperson || '',
    };
  } catch (error) {
    console.warn('Error extracting contact from kanban card:', error);
    return null;
  }
}

/**
 * Gets the data-tooltip attribute value or falls back to textContent.
 * Odoo often stores clean values in data-tooltip.
 */
function getTooltipOrText(element: Element | null): string {
  if (!element) {
    return '';
  }

  // Prefer data-tooltip for clean text
  const tooltip = element.getAttribute('data-tooltip');
  if (tooltip) {
    return tooltip.trim();
  }

  // Fall back to text content
  return element.textContent?.trim() || '';
}

/**
 * Extracts a field value by finding an icon and getting its sibling text.
 * Common pattern in Odoo kanban cards: <i class="fa-icon"/> <span>value</span>
 * Handles multiple spans for fields like location: <i class="fa-map-marker"/> <span></span> <span>India</span>
 */
function extractFieldByIcon(container: HTMLElement, iconClass: string): string {
  try {
    // Find the icon element - use robust selector that matches Odoo's class structure
    // Odoo uses: <i class="fa fa-fw me-1 fa-envelope text-primary" />
    const icon = container.querySelector(`i.fa.${iconClass}`) ||
                 container.querySelector(`i[class*="${iconClass}"]`);
    
    if (!icon) {
      return '';
    }

    // Check for immediate sibling span
    const sibling = icon.nextElementSibling;
    if (sibling && sibling.tagName === 'SPAN') {
      const text = sibling.textContent?.trim() || '';
      if (text) {
        return text;
      }
    }

    // Check parent for multiple spans (e.g., location field has empty span + country span)
    const parent = icon.parentElement;
    if (parent) {
      // Collect all sibling spans after the icon
      const siblingSpans: string[] = [];
      let node = icon.nextSibling;
      
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'SPAN') {
          const spanText = (node as HTMLElement).textContent?.trim() || '';
          if (spanText) {
            siblingSpans.push(spanText);
          }
        }
        node = node.nextSibling;
      }
      
      if (siblingSpans.length > 0) {
        return siblingSpans.join(' ');
      }

      // Fallback: Get text content from parent excluding icons
      const clone = parent.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('i').forEach((i) => i.remove());
      const text = clone.textContent?.trim() || '';
      if (text) {
        return text;
      }
    }

    return '';
  } catch (error) {
    console.warn(`Error extracting field by icon ${iconClass}:`, error);
    return '';
  }
}

/**
 * Extracts company information from a kanban card.
 */
function extractCompanyFromKanban(card: HTMLElement): string {
  try {
    // Look for company-related elements
    const companyElement =
      card.querySelector('[data-field="parent_id"]') ||
      card.querySelector('[data-field="company_name"]') ||
      card.querySelector('.o_kanban_record_subtitle');

    return companyElement?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Extracts salesperson from a kanban card.
 */
function extractSalespersonFromKanban(card: HTMLElement): string {
  try {
    const salespersonElement = card.querySelector('[data-field="user_id"]');
    return salespersonElement?.textContent?.trim() || '';
  } catch {
    return '';
  }
}
