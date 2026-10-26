import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SyncToggleProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  badge: ReactNode;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  /** Switch track colour when on. */
  onColor: string;
  /** Row background and border colours when on. */
  tint: { background: string; border: string };
}

/** One row of the Settings modal: icon, label, badge and description on the left, an on/off switch on the right. */
function SyncToggle({
  icon: Icon,
  iconColor,
  label,
  badge,
  description,
  enabled,
  onToggle,
  onColor,
  tint,
}: SyncToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px',
        background: enabled ? tint.background : 'transparent',
        borderRadius: '8px',
        border: enabled ? `1px solid ${tint.border}` : '1px solid transparent',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <Icon size={14} style={{ color: iconColor }} />
          <label
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {label}
          </label>
          {badge}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          {description}
        </p>
      </div>

      <button
        onClick={onToggle}
        style={{
          position: 'relative',
          width: '48px',
          height: '24px',
          borderRadius: '12px',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          backgroundColor: enabled ? onColor : '#d1d5db',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: enabled ? '26px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}

export default SyncToggle;
