import { useState, useMemo } from 'react';
import { Phone, Users, Mail, CheckSquare, FileText, Calendar, Trash2, Download } from 'lucide-react';
import type { Activity } from '../../shared/types';
import SearchBox from './SearchBox';
import { exportData } from '../../shared/export';
import { downloadFile } from '../../shared/download';
import { useToast } from '../hooks/useToast';

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
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { showToast } = useToast();

  const handleExport = (format: 'csv' | 'json') => {
    const content = exportData('activities', activities, format);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const ext = format === 'csv' ? 'csv' : 'json';
    downloadFile(`swades-activities-${Date.now()}.${ext}`, content, mime);
    showToast({ type: 'success', message: `Exported ${activities.length} activities as ${format.toUpperCase()}` });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

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

  const sortedActivities = useMemo(() => {
    if (!sortKey) return filteredActivities;
    return [...filteredActivities].sort((a, b) => {
      const aVal = a[sortKey as keyof Activity] ?? '';
      const bVal = b[sortKey as keyof Activity] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredActivities, sortKey, sortDirection]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'call': return <Phone size={16} />;
      case 'meeting': return <Users size={16} />;
      case 'email': return <Mail size={16} />;
      case 'todo': return <CheckSquare size={16} />;
      default: return <FileText size={16} />;
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Status:
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'done')}
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
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Type:
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivityType)}
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
          <option value="all">All Types</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="email">Email</option>
          <option value="todo">Todo</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Sort by:
        </label>
        <select
          value={sortKey}
          onChange={(e) => handleSort(e.target.value)}
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
          {sortOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        {sortKey && (
          <button
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
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
          disabled={activities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: activities.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: activities.length === 0 ? 'not-allowed' : 'pointer',
            color: activities.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (activities.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activities.length > 0) {
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
          disabled={activities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: activities.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: activities.length === 0 ? 'not-allowed' : 'pointer',
            color: activities.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (activities.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activities.length > 0) {
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
          disabled={activities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activities.length === 0 
              ? '#6b7280' 
              : 'linear-gradient(to right, #8B2E2E, #A03535)',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '0px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: activities.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: activities.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (activities.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = activities.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}
          onMouseDown={(e) => {
            if (activities.length > 0) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onMouseUp={(e) => {
            if (activities.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
        >
          <Trash2 size={18} /> Delete All
        </button>
      </div>

      {sortedActivities.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          color: 'var(--color-text-secondary)',
        }}>
          <Calendar size={48} strokeWidth={1.5} style={{ color: '#d1d5db', marginBottom: '12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>No activities found</p>
          <p style={{ fontSize: '12px' }}>
            {activities.length === 0
              ? 'Click "Extract Now" to fetch activities from Odoo'
              : 'No activities match your filter'}
          </p>
        </div>
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
                <span style={{
                  flex: 1,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {activity.summary}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  fontWeight: 600,
                  background: activity.status === 'open' ? '#dbeafe' : '#dcfce7',
                  color: activity.status === 'open' ? '#1e40af' : '#166534',
                  borderRadius: '4px',
                }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
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
