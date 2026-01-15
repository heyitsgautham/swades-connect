// Contact interface
export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  salesperson: string;
}

// Opportunity interface
export interface Opportunity {
  id: string;
  name: string;
  revenue: number;
  stage: string;
  probability: number;
  closeDate: string;
}

// Activity interface
export interface Activity {
  id: string;
  type: 'call' | 'meeting' | 'todo' | 'email';
  summary: string;
  dueDate: string;
  assignedTo: string;
  status: 'open' | 'done';
}

// Overall storage schema
export interface StorageSchema {
  odoo_data: {
    contacts: Contact[];
    opportunities: Opportunity[];
    activities: Activity[];
    lastSync: number;
  };
}
