/**
 * Conversions from raw Odoo RPC records to the extension's storage types.
 *
 * Odoo returns `false` for empty fields and encodes Many2one relations as
 * `[id, "Name"]` tuples or `{ id, display_name }` objects depending on the
 * endpoint, so every converter goes through the helpers below.
 * Nothing here touches the DOM or chrome APIs.
 */

import type { DataType } from '../shared/messages';
import type { Activity, Contact, Opportunity } from '../shared/types';
import { mapActivityType, parseCompleteName } from './parsing';

export type OdooRecord = Record<string, unknown>;
export type ExtensionRecord = Contact | Opportunity | Activity;

/** Id prefix per data type, shared with the DOM extractors. */
export const ID_PREFIX: Record<DataType, string> = {
  contacts: 'contact_',
  opportunities: 'opp_',
  activities: 'act_',
};

/**
 * Map Odoo model names to our extension data types.
 * mail.activity.schedule is the wizard model used for creating new activities.
 */
export function mapModelToDataType(model: string): DataType | null {
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
 * Convert Odoo's false values to appropriate defaults.
 * Odoo uses `false` instead of `null` for empty values.
 */
export function sanitizeOdooValue<T>(value: unknown, defaultValue: T): T {
  if (value === false || value === null || value === undefined) {
    return defaultValue;
  }
  return value as T;
}

/**
 * Extract the display name from a Many2one field, which can be
 * false, an `[id, "Name"]` tuple, an `{ id, display_name }` object, or a plain string.
 */
export function extractMany2oneName(value: unknown): string {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.length >= 2 ? String(value[1]) : '';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.display_name) return String(obj.display_name);
    if (obj.name) return String(obj.name);
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/**
 * Convert an Odoo res.partner record to a Contact.
 * Uses the `contact_{id}` format to match the DOM extractor.
 */
export function convertToContact(record: OdooRecord): Contact {
  const odooId = sanitizeOdooValue(record.id, '');

  let name =
    (sanitizeOdooValue(record.name, '') as string) || (sanitizeOdooValue(record.display_name, '') as string);

  // Company can be company_name (string), parent_id (Many2one) or parent_name.
  let company = sanitizeOdooValue(record.company_name, '') as string;
  if (!company) {
    company = extractMany2oneName(record.parent_id);
  }
  if (!company) {
    company = sanitizeOdooValue(record.parent_name, '') as string;
  }

  // Without an explicit name, complete_name may be "Company, Person".
  if (!name) {
    const completeName = sanitizeOdooValue(record.complete_name, '') as string;
    if (completeName) {
      const parsed = parseCompleteName(completeName);
      name = parsed.name;
      if (!company && parsed.company) {
        company = parsed.company;
      }
    }
  }

  return {
    id: `${ID_PREFIX.contacts}${odooId}`,
    name,
    email: sanitizeOdooValue(record.email, '') as string,
    phone: sanitizeOdooValue(record.phone, sanitizeOdooValue(record.mobile, '')) as string,
    company,
    country: extractMany2oneName(record.country_id),
  };
}

/**
 * Convert an Odoo crm.lead record to an Opportunity.
 *
 * Handles both additions (fields from args[1], stage_id as a bare number)
 * and edits (stage_id as `{ id, display_name }` or `[id, name]`).
 */
export function convertToOpportunity(record: OdooRecord): Opportunity {
  const odooId = sanitizeOdooValue(record.id, '');

  let stageName = '';
  const stageValue = record.stage_id;
  if (typeof stageValue === 'number') {
    // Additions only carry the stage id; keep a readable placeholder.
    stageName = `Stage ${stageValue}`;
  } else {
    stageName = extractMany2oneName(stageValue);
  }

  return {
    id: `${ID_PREFIX.opportunities}${odooId}`,
    name: sanitizeOdooValue(record.name, '') as string,
    revenue: sanitizeOdooValue(record.expected_revenue ?? record.revenue, 0) as number,
    stage: stageName,
    probability: sanitizeOdooValue(record.probability, 0) as number,
    closeDate: sanitizeOdooValue(record.date_deadline ?? record.closeDate, '') as string,
  };
}

/**
 * Convert an Odoo mail.activity record to an Activity.
 *
 * Additions from the schedule wizard use activity_user_id; edits and
 * web_search_read use user_id. Both are Many2one values.
 */
export function convertToActivity(record: OdooRecord): Activity {
  const odooId = sanitizeOdooValue(record.id, '');

  return {
    id: `${ID_PREFIX.activities}${odooId}`,
    type: mapActivityType(extractMany2oneName(record.activity_type_id)),
    summary: sanitizeOdooValue(record.summary, sanitizeOdooValue(record.note, '')) as string,
    dueDate: sanitizeOdooValue(record.date_deadline, '') as string,
    assignedTo: extractMany2oneName(record.activity_user_id || record.user_id),
    status: record.state === 'done' ? 'done' : 'open',
  };
}

/** Convert an Odoo record to the extension format for its data type. */
export function convertRecord(dataType: DataType, record: OdooRecord): ExtensionRecord {
  switch (dataType) {
    case 'contacts':
      return convertToContact(record);
    case 'opportunities':
      return convertToOpportunity(record);
    case 'activities':
      return convertToActivity(record);
  }
}

/** Records from a web_search_read result: `{ length, records: [...] }`. */
export function recordsFromSearchRead(result: unknown): OdooRecord[] {
  if (typeof result !== 'object' || result === null) return [];
  const records = (result as Record<string, unknown>).records;
  return Array.isArray(records) ? records.filter(isRecord) : [];
}

/** Records from every group of a web_read_group result: `{ groups: [{ __records: [...] }] }`. */
export function recordsFromReadGroup(result: unknown): OdooRecord[] {
  if (typeof result !== 'object' || result === null) return [];
  const groups = (result as Record<string, unknown>).groups;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => {
    const records = isRecord(group) ? group.__records : undefined;
    return Array.isArray(records) ? records.filter(isRecord) : [];
  });
}

/**
 * Raw records written by a create or web_save call.
 *
 * - Additions return only ids (`[{ id }]`); the field values are in args[1], so they are merged in.
 * - Edits usually return the full saved records.
 * - A bare numeric id carries no field data and yields nothing.
 */
export function recordsFromSave(args: unknown[], result: unknown): OdooRecord[] {
  const first = Array.isArray(result) ? result[0] : result;
  const hasOnlyId = isRecord(first) && Object.keys(first).length === 1 && 'id' in first;

  if (hasOnlyId && args.length >= 2) {
    const fieldData = isRecord(args[1]) ? args[1] : {};
    if (!Array.isArray(result)) return [];
    return result.filter((res) => isRecord(res) && 'id' in res).map((res) => ({ id: res.id, ...fieldData }));
  }

  if (Array.isArray(result)) {
    return result.filter(isRecord);
  }

  return isRecord(result) ? [result] : [];
}

function isRecord(value: unknown): value is OdooRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
