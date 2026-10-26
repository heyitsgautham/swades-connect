import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SyncToggleProps {
  icon: LucideIcon;
  /** Text colour class for the icon, such as text-primary. */
  iconClassName: string;
  label: string;
  badge: ReactNode;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  /** Background class for the switch track when on. */
  onClassName: string;
  /** Background and border classes for the whole row when on. */
  tintClassName: string;
}

/** One row of the Settings modal: icon, label, badge and description on the left, an on/off switch on the right. */
function SyncToggle({
  icon: Icon,
  iconClassName,
  label,
  badge,
  description,
  enabled,
  onToggle,
  onClassName,
  tintClassName,
}: SyncToggleProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
        enabled ? tintClassName : 'border-transparent bg-transparent'
      }`}
    >
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <Icon size={14} className={iconClassName} />
          <label className="text-[14px] font-medium text-text">{label}</label>
          {badge}
        </div>
        <p className="text-[12px] leading-[1.4] text-muted">{description}</p>
      </div>

      <button
        onClick={onToggle}
        className={`relative h-6 w-12 shrink-0 cursor-pointer rounded-[12px] [transition:background-color_0.2s] ${
          enabled ? onClassName : 'bg-[#d1d5db]'
        }`}
      >
        <div
          className={`absolute top-0.5 size-5 rounded-full bg-white [transition:left_0.2s] ${
            enabled ? 'left-[26px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default SyncToggle;
