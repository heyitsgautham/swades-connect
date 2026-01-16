import { useState } from 'react';
import { AlertCircle, CheckCircle, Settings as SettingsIcon } from 'lucide-react';
import { useStorage } from './hooks/useStorage';
import { useExtraction } from './hooks/useExtraction';
import { useToast } from './hooks/useToast';
import TabNavigation from './components/TabNavigation';
import ContactsTab from './components/ContactsTab';
import OpportunitiesTab from './components/OpportunitiesTab';
import ActivitiesTab from './components/ActivitiesTab';
import SyncStatus from './components/SyncStatus';
import ExtractButton from './components/ExtractButton';
import Settings from './components/Settings';
import './index.css';
import './App.css';

type TabType = 'contacts' | 'opportunities' | 'activities';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const [showSettings, setShowSettings] = useState(false);
  const { data, loading, error: storageError, deleteRecord, optimisticDelete, deleteAllRecords, refetch } = useStorage();
  const { isExtracting, error: extractionError, success, recordsExtracted, triggerExtraction, clearState } = useExtraction();
  const { showToast } = useToast();

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    clearState();
  };

  const handleExtract = async () => {
    await triggerExtraction();
    setTimeout(() => refetch(), 1000);
  };

  // Optimistic delete handler with rollback support
  const handleOptimisticDelete = async (type: 'contacts' | 'opportunities' | 'activities', id: string) => {
    // 1. Optimistically remove from UI and get rollback function
    const rollback = optimisticDelete(type, id);
    
    // 2. Perform actual delete
    const result = await deleteRecord(type, id);
    
    if (result.success) {
      // 3. Show success toast
      showToast({ type: 'success', message: 'Deleted successfully' });
    } else {
      // 4. Rollback on failure and show error toast
      rollback();
      showToast({ type: 'error', message: `Failed to delete. Restored item.` });
    }
  };

  // Delete all handler
  const handleDeleteAll = async (type: 'contacts' | 'opportunities' | 'activities') => {
    const count = data?.[type]?.length || 0;
    if (count === 0) return;
    
    if (!confirm(`Are you sure you want to delete all ${count} ${type}? This cannot be undone.`)) {
      return;
    }
    
    const result = await deleteAllRecords(type);
    
    if (result.success) {
      showToast({ type: 'success', message: `Deleted all ${count} ${type}` });
    } else {
      showToast({ type: 'error', message: `Failed to delete ${type}` });
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '500px',
        height: '400px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        background: 'var(--color-background)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '4px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading data...</p>
      </div>
    );
  }

  return (
    <div style={{
      width: '500px',
      minHeight: '400px',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-background)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-primary)',
        color: 'white',
        padding: '16px',
        borderBottom: '2px solid #7a2828',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 400,
            marginBottom: '4px',
            fontFamily: "var(--font-heading)",
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            Swades Connect
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, fontFamily: 'var(--font-body)' }}>
            Odoo CRM Extractor
          </p>
        </div>
        
        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.8,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          title="Settings"
        >
          <SettingsIcon size={20} />
        </button>
      </header>

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--color-accent)',
        borderBottom: '1px solid var(--color-border)',
        gap: '12px',
      }}>
        <SyncStatus lastSync={data?.lastSync} />
        <ExtractButton isLoading={isExtracting} onClick={handleExtract} />
      </div>

      {/* Status Messages */}
      {(storageError || extractionError) && (
        <div style={{
          padding: '12px 16px',
          margin: '8px 16px',
          background: '#fee2e2',
          color: '#991b1b',
          borderLeft: '4px solid #dc2626',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{storageError || extractionError}</span>
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          margin: '8px 16px',
          background: '#dcfce7',
          color: '#166534',
          borderLeft: '4px solid #16a34a',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <span>Extracted {recordsExtracted} records</span>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={data?.contacts || []}
            onDelete={(id) => handleOptimisticDelete('contacts', id)}
            onDeleteAll={() => handleDeleteAll('contacts')}
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunitiesTab
            opportunities={data?.opportunities || []}
            onDelete={(id) => handleOptimisticDelete('opportunities', id)}
            onDeleteAll={() => handleDeleteAll('opportunities')}
          />
        )}

        {activeTab === 'activities' && (
          <ActivitiesTab
            activities={data?.activities || []}
            onDelete={(id) => handleOptimisticDelete('activities', id)}
            onDeleteAll={() => handleDeleteAll('activities')}
          />
        )}
      </div>
      
      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
