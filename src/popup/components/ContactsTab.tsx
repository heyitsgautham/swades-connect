import { useState, useMemo } from 'react';
import { Users, Download, Trash2 } from 'lucide-react';
import type { Contact } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';
import { exportData } from '../../shared/export';
import { downloadFile } from '../../shared/download';
import { useToast } from '../hooks/useToast';

interface ContactsTabProps {
  contacts: Contact[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

function ContactsTab({ contacts, onDelete, onDeleteAll }: ContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { showToast } = useToast();

  const handleExport = (format: 'csv' | 'json') => {
    const content = exportData('contacts', contacts, format);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const ext = format === 'csv' ? 'csv' : 'json';
    downloadFile(`swades-contacts-${Date.now()}.${ext}`, content, mime);
    showToast({ type: 'success', message: `Exported ${contacts.length} contacts as ${format.toUpperCase()}` });
  };

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(contacts.map((c) => c.company).filter(Boolean));
    return Array.from(companies).sort();
  }, [contacts]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery && !companyFilter) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.company.toLowerCase().includes(query);
      const matchesCompany = !companyFilter || contact.company === companyFilter;
      return matchesSearch && matchesCompany;
    });
  }, [contacts, searchQuery, companyFilter]);

  const sortedContacts = useMemo(() => {
    if (!sortKey) return filteredContacts;
    return [...filteredContacts].sort((a, b) => {
      const aVal = a[sortKey as keyof Contact] ?? '';
      const bVal = b[sortKey as keyof Contact] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortKey, sortDirection]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by name, email, phone, or company..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={sortedContacts.length}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}>
          Company:
        </label>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">All Companies</option>
          {uniqueCompanies.map((company) => (
            <option key={company} value={company}>{company}</option>
          ))}
        </select>
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}>
          Export:
        </label>
        <button
          onClick={() => handleExport('csv')}
          disabled={contacts.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: contacts.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: contacts.length === 0 ? 'not-allowed' : 'pointer',
            color: contacts.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
        >
          <Download size={14} /> CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={contacts.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: contacts.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: contacts.length === 0 ? 'not-allowed' : 'pointer',
            color: contacts.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
        >
          <Download size={14} /> JSON
        </button>
        
        {/* Spacer to push Delete All to the right */}
        <div style={{ flex: 1 }} />
        
        <button
          onClick={onDeleteAll}
          disabled={contacts.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: contacts.length === 0 
              ? '#6b7280' 
              : 'linear-gradient(to right, #8B2E2E, #A03535)',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '0px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: contacts.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: contacts.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = contacts.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}
          onMouseDown={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onMouseUp={(e) => {
            if (contacts.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
        >
          <Trash2 size={18} /> Delete All
        </button>
      </div>

      {sortedContacts.length === 0 ? (
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
            { key: 'name', label: 'Name', sortable: true, width: '25%' },
            { key: 'email', label: 'Email', sortable: true, width: '23%' },
            { key: 'phone', label: 'Phone', sortable: true, width: '20%' },
            { key: 'company', label: 'Company', sortable: true, width: '20%' },
          ]}
          data={sortedContacts}
          onDelete={onDelete}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}
    </div>
  );
}

export default ContactsTab;
