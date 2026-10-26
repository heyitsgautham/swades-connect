import { Settings as SettingsIcon, X, Zap, Eye } from 'lucide-react';
import { useSyncPreference } from '../hooks/useSyncPreference';
import SyncToggle from './SyncToggle';

interface SettingsProps {
  onClose: () => void;
}

const badgeClassName = 'rounded px-1.5 py-0.5 text-[10px]';

function Settings({ onClose }: SettingsProps) {
  const [rpcSync, toggleRpcSync] = useSyncPreference('rpcSync');
  const [autoExtract, toggleAutoExtract] = useSyncPreference('autoExtract');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.5)]">
      <div className="w-[400px] max-w-[90%] rounded-lg bg-background p-6 shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon size={20} className="text-primary" />
            <h2 className="text-[18px] font-semibold">Settings</h2>
          </div>
          <button onClick={onClose} className="flex cursor-pointer items-center p-1 text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h3 className="mb-3 text-[13px] font-semibold tracking-[0.5px] text-muted uppercase">Sync Methods</h3>

            <div className="flex flex-col gap-3">
              <SyncToggle
                icon={Zap}
                iconClassName="text-primary"
                label="Real-time Sync"
                badge={<span className={`${badgeClassName} bg-primary font-semibold text-white`}>RECOMMENDED</span>}
                description="Intercepts Odoo's RPC calls for efficient, accurate data sync. Uses minimal resources and captures all data changes automatically."
                enabled={rpcSync}
                onToggle={toggleRpcSync}
                onClassName="bg-primary"
                tintClassName="border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.08)]"
              />
              <SyncToggle
                icon={Eye}
                iconClassName="text-[#22c55e]"
                label="Auto-Extract"
                badge={<span className={`${badgeClassName} bg-border font-medium text-muted`}>FALLBACK</span>}
                description="Monitors DOM changes and extracts visible data. Use as backup when RPC sync isn't available."
                enabled={autoExtract}
                onToggle={toggleAutoExtract}
                onClassName="bg-[#22c55e]"
                tintClassName="border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)]"
              />
            </div>
          </div>

          {rpcSync && (
            <div className="rounded border-l-[3px] border-primary bg-[rgba(99,102,241,0.1)] p-3">
              <p className="text-[12px] font-medium text-primary">
                ⚡ Real-time Sync is ON — Data syncs automatically via RPC interception
              </p>
            </div>
          )}

          {autoExtract && !rpcSync && (
            <div className="rounded border-l-[3px] border-[#16a34a] bg-[#dcfce7] p-3">
              <p className="text-[12px] text-[#166534]">
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
