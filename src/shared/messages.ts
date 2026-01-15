// Message action types
export type MessageAction = 
  | 'EXTRACT_DATA'
  | 'EXTRACTION_COMPLETE'
  | 'EXTRACTION_ERROR'
  | 'GET_DATA'
  | 'SAVE_DATA'
  | 'DELETE_RECORD'
  | 'STORAGE_UPDATED'
  | 'EXTRACT_STATUS'
  | 'TEST';

// Base message interface
export interface Message {
  action: MessageAction;
  data?: any;
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
    contacts: any[];
    opportunities: any[];
    activities: any[];
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
    contacts?: any[];
    opportunities?: any[];
    activities?: any[];
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
    contacts: any[];
    opportunities: any[];
    activities: any[];
    lastSync: number;
  };
}

// Union type for all messages
export type ExtensionMessage = 
  | ExtractDataMessage
  | ExtractionCompleteMessage
  | SaveDataMessage
  | DeleteRecordMessage
  | StorageUpdatedMessage
  | Message;

// Response interface
export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}
