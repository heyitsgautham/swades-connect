import type { Contact, Opportunity, Activity } from './types';

// Message action types
export type MessageAction = 
  | 'EXTRACT_DATA'
  | 'EXTRACTION_COMPLETE'
  | 'EXTRACTION_ERROR'
  | 'GET_DATA'
  | 'SAVE_DATA'
  | 'DELETE_RECORD'
  | 'DELETE_ALL_RECORDS'
  | 'TOGGLE_AUTO_EXTRACT'
  | 'TOGGLE_RPC_SYNC'
  | 'UPDATE_BADGE'
  | 'STORAGE_UPDATED'
  | 'EXTRACT_STATUS'
  | 'ODOO_RPC_UPSERT'
  | 'ODOO_RPC_DELETE'
  | 'TEST';

// Data type for RPC messages
export type DataType = 'contacts' | 'opportunities' | 'activities';

// Base message interface
export interface Message {
  action: MessageAction;
  data?: unknown;
  error?: string;
  timestamp?: number;
}

// Typed message for extraction request
export interface ExtractDataMessage extends Message {
  action: 'EXTRACT_DATA';
  data?: {
    includeContacts?: boolean;
    includeOpportunities?: boolean;
    includeActivities?: boolean;
  };
}

// Typed message for extraction complete
export interface ExtractionCompleteMessage extends Message {
  action: 'EXTRACTION_COMPLETE';
  data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    metadata: {
      viewType: string;
      dataModel: string;
      recordsExtracted: number;
      extractionTimeMs: number;
      timestamp: string;
    };
  };
}

// Typed message for save data
export interface SaveDataMessage extends Message {
  action: 'SAVE_DATA';
  data: {
    contacts?: Contact[];
    opportunities?: Opportunity[];
    activities?: Activity[];
  };
}

// Typed message for delete record
export interface DeleteRecordMessage extends Message {
  action: 'DELETE_RECORD';
  data: {
    type: 'contacts' | 'opportunities' | 'activities';
    id: string;
  };
}

// Typed message for storage update
export interface StorageUpdatedMessage extends Message {
  action: 'STORAGE_UPDATED';
  data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number;
  };
}

// Typed message for RPC upsert (create or update)
export interface RpcUpsertMessage extends Message {
  action: 'ODOO_RPC_UPSERT';
  data: {
    type: DataType;
    records: (Contact | Opportunity | Activity)[];
  };
}

// Typed message for RPC delete
export interface RpcDeleteMessage extends Message {
  action: 'ODOO_RPC_DELETE';
  data: {
    type: DataType;
    ids: string[];
  };
}

// Typed message for toggle RPC sync
export interface ToggleRpcSyncMessage extends Message {
  action: 'TOGGLE_RPC_SYNC';
  enabled: boolean;
}

// Union type for all messages
export type ExtensionMessage = 
  | ExtractDataMessage
  | ExtractionCompleteMessage
  | SaveDataMessage
  | DeleteRecordMessage
  | StorageUpdatedMessage
  | RpcUpsertMessage
  | RpcDeleteMessage
  | ToggleRpcSyncMessage
  | Message;

// Response interface
export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
