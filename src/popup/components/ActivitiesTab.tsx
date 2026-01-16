import { useState, useMemo } from 'react';
import { Phone, Users, Mail, CheckSquare, FileText, Calendar, Trash2 } from 'lucide-react';
import type { Activity } from '../../shared/types';
import SearchBox from './SearchBox';

interface ActivitiesTabProps {
  activities: Activity[];
  onDelete: (id: string) => void;
}

function ActivitiesTab({ activities, onDelete }: ActivitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'done'>('all');

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        activity.summary.toLowerCase().includes(query) ||
        activity.type.toLowerCase().includes(query) ||
        activity.assignedTo.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activities, searchQuery, statusFilter]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'call': return <Phone size={16} />;
      case 'meeting': return <Users size={16} />;
      case 'email': return <Mail size={16} />;
      case 'todo': return <CheckSquare size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by summary, type, or assignee..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={filteredActivities.length}
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

      {filteredActivities.length === 0 ? (
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
          {filteredActivities.map((activity) => (
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
