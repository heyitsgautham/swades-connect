import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Zap, Eye } from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
}

function Settings({ onClose }: SettingsProps) {
  const [autoExtract, setAutoExtract] = useState(false);
  const [rpcSync, setRpcSync] = useState(false);

  useEffect(() => {
    // Load preferences from storage
    chrome.storage.local.get(['auto_extract_enabled', 'rpc_sync_enabled'], (result) => {
      setAutoExtract(!!result.auto_extract_enabled);
      setRpcSync(!!result.rpc_sync_enabled);
    });
  }, []);

  const handleAutoExtractToggle = async () => {
    const newValue = !autoExtract;
    setAutoExtract(newValue);

    // Save to storage
    await chrome.storage.local.set({ auto_extract_enabled: newValue });

    // Send message to active tab to toggle DOM watcher
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'TOGGLE_AUTO_EXTRACT',
        enabled: newValue,
      });
    }
  };

  const handleRpcSyncToggle = async () => {
    const newValue = !rpcSync;
    setRpcSync(newValue);

    // Save to storage
    await chrome.storage.local.set({ rpc_sync_enabled: newValue });

    // Send message to active tab to toggle RPC sync
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'TOGGLE_RPC_SYNC',
        enabled: newValue,
      });
    }
  };

  return (
    <div style={{
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
    }}>
      <div style={{
        background: 'var(--color-background)',
        borderRadius: '8px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
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

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Sync Methods Section */}
          <div>
            <h3 style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Sync Methods
            </h3>

            {/* Real-time Sync Toggle (RPC-based) */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px',
              background: rpcSync ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              borderRadius: '8px',
              border: rpcSync ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
              marginBottom: '12px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Zap size={14} style={{ color: 'var(--color-primary)' }} />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}>
                    Real-time Sync
                  </label>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'white',
                    background: 'var(--color-primary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    RECOMMENDED
                  </span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  lineHeight: '1.4',
                }}>
                  Intercepts Odoo's RPC calls for efficient, accurate data sync. Uses minimal resources and captures all data changes automatically.
                </p>
              </div>
              
              <button
                onClick={handleRpcSyncToggle}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor: rpcSync ? 'var(--color-primary)' : '#d1d5db',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: rpcSync ? '26px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Auto-Extract Toggle (DOM-based) */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px',
              background: autoExtract ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
              borderRadius: '8px',
              border: autoExtract ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid transparent',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Eye size={14} style={{ color: '#22c55e' }} />
                  <label style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}>
                    Auto-Extract
                  </label>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-border)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    FALLBACK
                  </span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  lineHeight: '1.4',
                }}>
                  Monitors DOM changes and extracts visible data. Use as backup when RPC sync isn't available.
                </p>
              </div>
              
              <button
                onClick={handleAutoExtractToggle}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor: autoExtract ? '#22c55e' : '#d1d5db',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: autoExtract ? '26px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {rpcSync && (
            <div style={{
              padding: '12px',
              background: 'rgba(99, 102, 241, 0.1)',
              borderLeft: '3px solid var(--color-primary)',
              borderRadius: '4px',
            }}>
              <p style={{
                fontSize: '12px',
                color: 'var(--color-primary)',
                margin: 0,
                fontWeight: 500,
              }}>
                ⚡ Real-time Sync is ON — Data syncs automatically via RPC interception
              </p>
            </div>
          )}

          {autoExtract && !rpcSync && (
            <div style={{
              padding: '12px',
              background: '#dcfce7',
              borderLeft: '3px solid #16a34a',
              borderRadius: '4px',
            }}>
              <p style={{
                fontSize: '12px',
                color: '#166534',
                margin: 0,
              }}>
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
