import { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Contact } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';

interface ContactsTabProps {
  contacts: Contact[];
  onDelete: (id: string) => void;
}

function ContactsTab({ contacts, onDelete }: ContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.phone.includes(query) ||
      contact.company.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by name, email, phone, or company..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={filteredContacts.length}
      />

      {filteredContacts.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          color: 'var(--color-text-secondary)',
        }}>
          <Users size={48} strokeWidth={1.5} style={{ color: '#d1d5db', marginBottom: '12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>No contacts found</p>
          <p style={{ fontSize: '12px' }}>
            {contacts.length === 0
              ? 'Click "Extract Now" to fetch contacts from Odoo'
              : 'No contacts match your search'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'company', label: 'Company' },
          ]}
          data={filteredContacts}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export default ContactsTab;
