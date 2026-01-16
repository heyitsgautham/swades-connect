import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncStatusProps {
  lastSync: number | undefined;
}

function SyncStatus({ lastSync }: SyncStatusProps) {
  const syncText = useMemo(() => {
    if (!lastSync) {
      return 'Never synced';
    }

    const now = Date.now();
    const diffMs = now - lastSync;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }, [lastSync]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--color-text-secondary)',
      background: 'rgba(255, 255, 255, 0.5)',
      padding: '6px 12px',
      borderRadius: '9999px',
      border: '1px solid var(--color-border)',
    }}>
      <RefreshCw size={12} />
      <span>Last sync: {syncText}</span>
    </div>
  );
}

export default SyncStatus;
