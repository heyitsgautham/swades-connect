/**
 * Odoo View Detection Utility
 *
 * Detects the current Odoo view type, data model, and version
 * based on DOM structure and URL patterns.
 */

// View types supported by Odoo
export type OdooViewType = 'list' | 'kanban' | 'form' | 'activity' | 'unknown';

// Data models we extract data from
export type OdooDataModel =
  | 'res.partner'
  | 'crm.lead'
  | 'mail.activity'
  | 'unknown';

/**
 * Odoo session info interface (partial - only what we need)
 */
interface OdooSessionInfo {
  server_version?: string;
  server_version_info?: (string | number)[];
  db?: string;
  uid?: number;
}

/**
 * Global odoo object interface
 */
interface OdooGlobal {
  __session_info__?: OdooSessionInfo;
  csrf_token?: string;
  debug?: string;
}

// Declare the global odoo object
declare const odoo: OdooGlobal | undefined;

/**
 * Detects the current Odoo view type by checking for view-specific CSS classes.
 *
 * Odoo uses these container classes:
 * - `.o_list_view` - List/tree view
 * - `.o_kanban_view` - Kanban board view
 * - `.o_form_view` - Form/detail view
 * - `.o_activity_view` - Activity schedule view
 *
 * @returns The detected view type or 'unknown' if not detected
 */
export function detectViewType(): OdooViewType {
  // Check for list view container
  // Note: Activity list also uses o_list_view, so we check activity first
  if (document.querySelector('.o_activity_view')) {
    return 'activity';
  }

  if (document.querySelector('.o_list_view')) {
    return 'list';
  }

  if (document.querySelector('.o_kanban_view')) {
    return 'kanban';
  }

  if (document.querySelector('.o_form_view')) {
    return 'form';
  }

  return 'unknown';
}

/**
 * Detects the current Odoo data model based on URL patterns and DOM content.
 *
 * Detection strategies (in order of reliability):
 * 1. URL query parameter: `model=res.partner`
 * 2. URL path patterns: `/contacts/`, `/crm/`, `/leads/`, `/pipeline/`, `/activities/`
 * 3. DOM data attributes: `data-tooltip-info` contains resModel
 * 4. Page title analysis
 *
 * @returns The detected data model or 'unknown' if not detected
 */
export function detectDataModel(): OdooDataModel {
  const url = window.location.href;
  const pathname = window.location.pathname;

  // Strategy 1: Check URL query parameter (most reliable)
  const urlParams = new URLSearchParams(window.location.search);
  const modelParam = urlParams.get('model');
  if (modelParam) {
    if (modelParam === 'res.partner') return 'res.partner';
    if (modelParam === 'crm.lead') return 'crm.lead';
    if (modelParam === 'mail.activity') return 'mail.activity';
  }

  // Strategy 2: Check URL path patterns
  // Contacts (res.partner)
  if (
    url.includes('/contacts/') ||
    url.includes('model=res.partner') ||
    pathname.includes('/partners/')
  ) {
    return 'res.partner';
  }

  // CRM Leads/Opportunities (crm.lead)
  if (
    url.includes('/crm/') ||
    url.includes('/leads/') ||
    url.includes('/pipeline/') ||
    url.includes('model=crm.lead')
  ) {
    return 'crm.lead';
  }

  // Activities (mail.activity)
  if (
    url.includes('/activities/') ||
    url.includes('model=mail.activity') ||
    pathname.includes('/mail/activity/')
  ) {
    return 'mail.activity';
  }

  // Strategy 3: Check DOM for model info in data attributes
  const modelFromDom = detectModelFromDom();
  if (modelFromDom !== 'unknown') {
    return modelFromDom;
  }

  // Strategy 4: Check page title for hints
  const title = document.title.toLowerCase();
  if (title.includes('customer') || title.includes('contact')) {
    return 'res.partner';
  }
  if (
    title.includes('pipeline') ||
    title.includes('lead') ||
    title.includes('opportunit')
  ) {
    return 'crm.lead';
  }
  if (title.includes('activit')) {
    return 'mail.activity';
  }

  return 'unknown';
}

/**
 * Attempts to detect the data model from DOM data attributes.
 *
 * Odoo embeds model info in `data-tooltip-info` attributes on column headers.
 * Example: `{"viewMode":"list","resModel":"res.partner",...}`
 *
 * @returns The detected data model or 'unknown'
 */
function detectModelFromDom(): OdooDataModel {
  try {
    // Look for data-tooltip-info attributes that contain resModel
    const tooltipElements = document.querySelectorAll('[data-tooltip-info]');

    for (const element of tooltipElements) {
      const tooltipInfo = element.getAttribute('data-tooltip-info');
      if (!tooltipInfo) continue;

      try {
        const parsed = JSON.parse(tooltipInfo);
        const resModel = parsed.resModel;

        if (resModel === 'res.partner') return 'res.partner';
        if (resModel === 'crm.lead') return 'crm.lead';
        if (resModel === 'mail.activity') return 'mail.activity';
      } catch {
        // JSON parse failed, continue to next element
        continue;
      }
    }
  } catch (error) {
    console.warn('[viewDetector] Error detecting model from DOM:', error);
  }

  return 'unknown';
}

/**
 * Gets the Odoo server version.
 *
 * Detection strategies:
 * 1. `odoo.__session_info__.server_version` (most reliable, e.g., "19.0+e")
 * 2. `[data-version]` attribute on page elements
 * 3. Meta tags or other page content
 *
 * @returns The Odoo version string or 'unknown'
 */
export function getOdooVersion(): string {
  // Strategy 1: Check global odoo object (most reliable)
  try {
    if (typeof odoo !== 'undefined' && odoo?.__session_info__?.server_version) {
      return odoo.__session_info__.server_version;
    }
  } catch (error) {
    console.warn('[viewDetector] Error accessing odoo global:', error);
  }

  // Strategy 2: Check for data-version attribute
  const versionElement = document.querySelector('[data-version]');
  if (versionElement) {
    const version = versionElement.getAttribute('data-version');
    if (version) {
      return version;
    }
  }

  // Strategy 3: Try to extract from script content
  try {
    const scripts = document.querySelectorAll(
      'script:not([src])'
    ) as NodeListOf<HTMLScriptElement>;
    for (const script of scripts) {
      const content = script.textContent || '';
      // Look for server_version in the inline script
      const versionMatch = content.match(/"server_version":\s*"([^"]+)"/);
      if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
      }
    }
  } catch (error) {
    console.warn('[viewDetector] Error parsing script content:', error);
  }

  return 'unknown';
}

/**
 * Gets comprehensive view context information.
 *
 * @returns Object with view type, data model, and version
 */
export function getViewContext(): {
  viewType: OdooViewType;
  dataModel: OdooDataModel;
  version: string;
  url: string;
  title: string;
} {
  return {
    viewType: detectViewType(),
    dataModel: detectDataModel(),
    version: getOdooVersion(),
    url: window.location.href,
    title: document.title,
  };
}

/**
 * Checks if the current page is an Odoo page.
 *
 * @returns True if the page appears to be an Odoo application
 */
export function isOdooPage(): boolean {
  // Check for main Odoo web client container
  if (document.querySelector('.o_web_client')) {
    return true;
  }

  // Check for odoo global object
  try {
    if (typeof odoo !== 'undefined' && odoo?.__session_info__) {
      return true;
    }
  } catch {
    // Access denied or undefined
  }

  // Check for common Odoo elements
  if (
    document.querySelector('.o_main_navbar') ||
    document.querySelector('.o_action_manager')
  ) {
    return true;
  }

  return false;
}

/**
 * Waits for the Odoo web client to be ready.
 *
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves when Odoo is ready, or rejects on timeout
 */
export function waitForOdooReady(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkReady = () => {
      // Check if main container is visible
      const webClient = document.querySelector('.o_web_client');
      if (webClient && (webClient as HTMLElement).offsetHeight > 0) {
        resolve();
        return;
      }

      // Check timeout
      if (Date.now() - startTime >= timeout) {
        reject(new Error('Timeout waiting for Odoo to be ready'));
        return;
      }

      // Check again after a short delay
      setTimeout(checkReady, 100);
    };

    checkReady();
  });
}
