import { Settings as SettingsIcon, X, Zap, Eye } from 'lucide-react';
import { useSyncPreference } from '../hooks/useSyncPreference';
import SyncToggle from './SyncToggle';

interface SettingsProps {
  onClose: () => void;
}

function Settings({ onClose }: SettingsProps) {
  const [rpcSync, toggleRpcSync] = useSyncPreference('rpcSync');
  const [autoExtract, toggleAutoExtract] = useSyncPreference('autoExtract');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--color-background)',
          borderRadius: '8px',
          padding: '24px',
          width: '400px',
          maxWidth: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={20} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Settings</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Sync Methods Section */}
          <div>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
              }}
            >
              Sync Methods
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SyncToggle
                icon={Zap}
                iconColor="var(--color-primary)"
                label="Real-time Sync"
                badge={
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'white',
                      background: 'var(--color-primary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    RECOMMENDED
                  </span>
                }
                description="Intercepts Odoo's RPC calls for efficient, accurate data sync. Uses minimal resources and captures all data changes automatically."
                enabled={rpcSync}
                onToggle={toggleRpcSync}
                onColor="var(--color-primary)"
                tint={{ background: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)' }}
              />
              <SyncToggle
                icon={Eye}
                iconColor="#22c55e"
                label="Auto-Extract"
                badge={
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-border)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    FALLBACK
                  </span>
                }
                description="Monitors DOM changes and extracts visible data. Use as backup when RPC sync isn't available."
                enabled={autoExtract}
                onToggle={toggleAutoExtract}
                onColor="#22c55e"
                tint={{ background: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)' }}
              />
            </div>
          </div>

          {/* Status Messages */}
          {rpcSync && (
            <div
              style={{
                padding: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderLeft: '3px solid var(--color-primary)',
                borderRadius: '4px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-primary)',
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                ⚡ Real-time Sync is ON — Data syncs automatically via RPC interception
              </p>
            </div>
          )}

          {autoExtract && !rpcSync && (
            <div
              style={{
                padding: '12px',
                background: '#dcfce7',
                borderLeft: '3px solid #16a34a',
                borderRadius: '4px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#166534',
                  margin: 0,
                }}
              >
                ✓ Auto-extract is ON. The extension badge will show "ON" when active.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
