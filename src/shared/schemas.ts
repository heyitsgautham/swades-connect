/**
 * Runtime schemas for every message that crosses an extension boundary.
 *
 * chrome.runtime messages arrive as untyped structured-clone data, from the
 * popup, from content scripts and, indirectly, from the Odoo page through the
 * RPC interceptor. The service worker and content script parse each message
 * here before acting on it, instead of casting it to the expected shape.
 */

import { z } from 'zod';
import type { Activity, Contact, Opportunity } from './types';

export const dataTypeSchema = z.enum(['contacts', 'opportunities', 'activities']);

export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string(),
  country: z.string(),
}) satisfies z.ZodType<Contact>;

export const opportunitySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  revenue: z.number(),
  stage: z.string(),
  probability: z.number(),
  closeDate: z.string(),
}) satisfies z.ZodType<Opportunity>;

export const activitySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['call', 'meeting', 'todo', 'email']),
  summary: z.string(),
  dueDate: z.string(),
  assignedTo: z.string(),
  status: z.enum(['open', 'done']),
}) satisfies z.ZodType<Activity>;

const recordBatches = {
  contacts: z.array(contactSchema),
  opportunities: z.array(opportunitySchema),
  activities: z.array(activitySchema),
};

/** Every stored record and the last sync time, as GET_DATA replies and STORAGE_UPDATED broadcasts carry them. */
export const storedDataSchema = z.object({
  contacts: recordBatches.contacts,
  opportunities: recordBatches.opportunities,
  activities: recordBatches.activities,
  lastSync: z.number(),
});

export type StoredData = z.infer<typeof storedDataSchema>;

/** The reply shape every service worker handler sends back. */
export const messageResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

/** Broadcast from the service worker to open popups after stored data changes. */
export const storageUpdatedMessageSchema = z.object({
  action: z.literal('STORAGE_UPDATED'),
  data: storedDataSchema,
});

const extractionMetadataSchema = z.object({
  viewType: z.string(),
  dataModel: z.string(),
  recordsExtracted: z.number(),
  extractionTimeMs: z.number(),
  timestamp: z.string(),
});

/** Messages the service worker accepts, keyed by action. */
export const backgroundMessageSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('EXTRACT_DATA'),
    data: z
      .object({
        includeContacts: z.boolean().optional(),
        includeOpportunities: z.boolean().optional(),
        includeActivities: z.boolean().optional(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('EXTRACTION_COMPLETE'),
    data: z.object({
      contacts: recordBatches.contacts,
      opportunities: recordBatches.opportunities,
      activities: recordBatches.activities,
      metadata: extractionMetadataSchema.optional(),
    }),
  }),
  z.object({ action: z.literal('EXTRACTION_ERROR'), error: z.string().optional() }),
  z.object({ action: z.literal('GET_DATA') }),
  z.object({
    action: z.literal('SAVE_DATA'),
    data: z.object({
      contacts: recordBatches.contacts.optional(),
      opportunities: recordBatches.opportunities.optional(),
      activities: recordBatches.activities.optional(),
    }),
  }),
  z.object({
    action: z.literal('DELETE_RECORD'),
    data: z.object({ type: dataTypeSchema, id: z.string().min(1) }),
  }),
  z.object({ action: z.literal('DELETE_ALL_RECORDS'), data: z.object({ type: dataTypeSchema }) }),
  z.object({ action: z.literal('UPDATE_BADGE'), data: z.object({ text: z.string() }) }),
  z.object({
    action: z.literal('ODOO_RPC_UPSERT'),
    data: z.discriminatedUnion('type', [
      z.object({ type: z.literal('contacts'), records: recordBatches.contacts }),
      z.object({ type: z.literal('opportunities'), records: recordBatches.opportunities }),
      z.object({ type: z.literal('activities'), records: recordBatches.activities }),
    ]),
  }),
  z.object({
    action: z.literal('ODOO_RPC_DELETE'),
    data: z.object({ type: dataTypeSchema, ids: z.array(z.string().min(1)) }),
  }),
  z.object({ action: z.literal('TEST') }),
]);

export type BackgroundMessage = z.infer<typeof backgroundMessageSchema>;
export type BackgroundAction = BackgroundMessage['action'];

/** Messages the content script accepts from the popup and service worker. */
export const contentMessageSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('EXTRACT_DATA') }),
  z.object({ action: z.literal('TOGGLE_AUTO_EXTRACT'), enabled: z.boolean() }),
  z.object({ action: z.literal('TOGGLE_RPC_SYNC'), enabled: z.boolean() }),
]);

export type ContentMessage = z.infer<typeof contentMessageSchema>;

export type ParseResult<T> =
  | { ok: true; message: T }
  | { ok: false; reason: 'unknown-action'; action: unknown }
  | { ok: false; reason: 'invalid'; action: string; issues: string[] };

function actionOf(raw: unknown): unknown {
  return typeof raw === 'object' && raw !== null ? (raw as { action?: unknown }).action : undefined;
}

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

function parseWith<T>(schema: z.ZodType<T>, actions: readonly string[], raw: unknown): ParseResult<T> {
  const action = actionOf(raw);
  if (typeof action !== 'string' || !actions.includes(action)) {
    return { ok: false, reason: 'unknown-action', action };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, reason: 'invalid', action, issues: describeIssues(result.error) };
  }
  return { ok: true, message: result.data };
}

const BACKGROUND_ACTIONS = backgroundMessageSchema.options.map((option) => option.shape.action.value);
const CONTENT_ACTIONS = contentMessageSchema.options.map((option) => option.shape.action.value);

/** Validate a message received by the service worker. */
export function parseBackgroundMessage(raw: unknown): ParseResult<BackgroundMessage> {
  return parseWith(backgroundMessageSchema, BACKGROUND_ACTIONS, raw);
}

/** Validate a message received by the content script. */
export function parseContentMessage(raw: unknown): ParseResult<ContentMessage> {
  return parseWith(contentMessageSchema, CONTENT_ACTIONS, raw);
}
