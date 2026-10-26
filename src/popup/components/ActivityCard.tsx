import { Phone, Users, Mail, CheckSquare, FileText, Trash2, type LucideIcon } from 'lucide-react';
import type { Activity } from '../../shared/types';
import { deleteIconButtonClassName } from './controlStyles';

const ACTIVITY_ICONS: Record<Activity['type'], LucideIcon> = {
  call: Phone,
  meeting: Users,
  email: Mail,
  todo: CheckSquare,
};

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
}

/** One activity in the Activities tab: icon, summary, status pill and delete button, then type, due date and assignee. */
function ActivityCard({ activity, onDelete }: ActivityCardProps) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? FileText;

  return (
    <div className="relative rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] [transition:box-shadow_0.2s_ease] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex items-center">
          <Icon size={16} />
        </span>
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
  );
}

export default ActivityCard;
