// Message action types for communication between components
export type MessageAction = 
  | 'EXTRACT_CONTACTS' 
  | 'EXTRACT_OPPORTUNITIES' 
  | 'EXTRACT_ACTIVITIES' 
  | 'GET_DATA'
  | 'TEST';

export interface Message {
  action: MessageAction;
  data?: unknown;
}

export interface MessageResponse {
  status: 'success' | 'error' | 'acknowledged';
  data?: unknown;
  error?: string;
}
