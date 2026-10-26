import { useId, useState, useMemo } from 'react';
import { Phone, Users, Mail, CheckSquare, FileText, Calendar, Trash2 } from 'lucide-react';
import type { Activity } from '../../shared/types';
import SearchBox from './SearchBox';
import { EmptyState, ExportBar, FilterRow, FilterSelect } from './TabControls';
import { deleteIconButtonClassName, selectClassName } from './controlStyles';
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
  const sortSelectId = useId();

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
    <div className="flex flex-col gap-3">
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

      <FilterRow label="Sort by:" htmlFor={sortSelectId}>
        <select
          id={sortSelectId}
          value={sortKey}
          onChange={(e) => handleSort(e.target.value)}
          className={selectClassName}
        >
          {sortOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        {sortKey && (
          <button
            onClick={toggleDirection}
            className="cursor-pointer border border-border bg-transparent px-2.5 py-1.5 text-[12px] text-text"
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
        <div className="flex flex-col gap-2">
          {sortedActivities.map((activity) => (
            <div
              key={activity.id}
              className="relative rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] [transition:box-shadow_0.2s_ease] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex items-center">{getActivityIcon(activity.type)}</span>
                <span className="flex-1 truncate font-semibold text-text">{activity.summary}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    activity.status === 'open' ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-[#dcfce7] text-[#166534]'
                  }`}
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
                  className={deleteIconButtonClassName}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-muted">
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
