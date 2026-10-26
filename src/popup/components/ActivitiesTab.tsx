import { useState, useMemo } from 'react';
import { Phone, Users, Mail, CheckSquare, FileText, Calendar, Trash2 } from 'lucide-react';
import type { Activity } from '../../shared/types';
import SearchBox from './SearchBox';
import { EmptyState, ExportBar, FilterRow, FilterSelect } from './TabControls';
import { selectClassName } from './controlStyles';
import { useExport } from '../hooks/useExport';
import { useSort } from '../hooks/useSort';

interface ActivitiesTabProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

type ActivityType = Activity['type'] | 'all';

function ActivitiesTab({ activities, onDelete, onDeleteAll }: ActivitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done'>('all');
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const handleExport = useExport('activities', activities);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        activity.summary.toLowerCase().includes(query) ||
        activity.type.toLowerCase().includes(query) ||
        activity.assignedTo.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
      const matchesType = typeFilter === 'all' || activity.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [activities, searchQuery, statusFilter, typeFilter]);

  const { sorted: sortedActivities, sortKey, sortDirection, handleSort, toggleDirection } = useSort(filteredActivities);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'call':
        return <Phone size={16} />;
      case 'meeting':
        return <Users size={16} />;
      case 'email':
        return <Mail size={16} />;
      case 'todo':
        return <CheckSquare size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const sortOptions = [
    { key: '', label: 'Default' },
    { key: 'summary', label: 'Summary' },
    { key: 'type', label: 'Type' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by summary, type, or assignee..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={sortedActivities.length}
      />

      <FilterSelect
        label="Status:"
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as 'all' | 'open' | 'done')}
        options={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' },
        ]}
      />

      <FilterSelect
        label="Type:"
        value={typeFilter}
        onChange={(value) => setTypeFilter(value as ActivityType)}
        options={[
          { value: 'all', label: 'All Types' },
          { value: 'call', label: 'Call' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'email', label: 'Email' },
          { value: 'todo', label: 'Todo' },
        ]}
      />

      <FilterRow label="Sort by:">
        <select value={sortKey} onChange={(e) => handleSort(e.target.value)} className={selectClassName}>
          {sortOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        {sortKey && (
          <button
            onClick={toggleDirection}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: '0px',
              fontSize: '12px',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
          >
            {sortDirection === 'asc' ? '▲ Asc' : '▼ Desc'}
          </button>
        )}
      </FilterRow>

      <ExportBar recordCount={activities.length} onExport={handleExport} onDeleteAll={onDeleteAll} />

      {sortedActivities.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No activities found"
          hint={
            activities.length === 0
              ? 'Click "Extract Now" to fetch activities from Odoo'
              : 'No activities match your filter'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedActivities.map((activity) => (
            <div
              key={activity.id}
              style={{
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                background: '#ffffff',
                position: 'relative',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                transition: 'box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{getActivityIcon(activity.type)}</span>
                <span
                  style={{
                    flex: 1,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activity.summary}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    fontWeight: 600,
                    background: activity.status === 'open' ? '#dbeafe' : '#dcfce7',
                    color: activity.status === 'open' ? '#1e40af' : '#166534',
                    borderRadius: '4px',
                  }}
                >
                  {activity.status}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete activity "${activity.summary}"?`)) {
                      onDelete(activity.id);
                    }
                  }}
                  title="Remove from storage"
                  style={{
                    padding: '6px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.background = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <span>Type: {activity.type}</span>
                <span>Due: {activity.dueDate || 'No date'}</span>
                <span>Assigned: {activity.assignedTo || 'Unassigned'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActivitiesTab;
