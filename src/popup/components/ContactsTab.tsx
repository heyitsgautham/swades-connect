import { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Contact } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';
import { EmptyState, ExportBar, FilterSelect } from './TabControls';
import { useExport } from '../hooks/useExport';
import { useSort } from '../hooks/useSort';

interface ContactsTabProps {
  contacts: Contact[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

function ContactsTab({ contacts, onDelete, onDeleteAll }: ContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const handleExport = useExport('contacts', contacts);

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(contacts.map((c) => c.company).filter(Boolean));
    return Array.from(companies).sort();
  }, [contacts]);

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

  const { sorted: sortedContacts, sortKey, sortDirection, handleSort } = useSort(filteredContacts);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by name, email, phone, or company..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={sortedContacts.length}
      />

      <FilterSelect
        label="Company:"
        value={companyFilter}
        onChange={setCompanyFilter}
        options={[
          { value: '', label: 'All Companies' },
          ...uniqueCompanies.map((company) => ({ value: company, label: company })),
        ]}
      />

      <ExportBar recordCount={contacts.length} onExport={handleExport} onDeleteAll={onDeleteAll} />

      {sortedContacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts found"
          hint={
            contacts.length === 0 ? 'Click "Extract Now" to fetch contacts from Odoo' : 'No contacts match your search'
          }
        />
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
