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
import { createLogger } from '../shared/logger';
import './index.css';
import './App.css';

type TabType = 'contacts' | 'opportunities' | 'activities';

const log = createLogger('popup');

const bannerClassName = 'mx-4 my-2 flex items-center gap-2 border-l-4 px-4 py-3 text-[12px] font-medium';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const [showSettings, setShowSettings] = useState(false);
  const {
    data,
    loading,
    error: storageError,
    deleteRecord,
    optimisticDelete,
    deleteAllRecords,
    refetch,
  } = useStorage();
  const {
    isExtracting,
    error: extractionError,
    success,
    recordsExtracted,
    triggerExtraction,
    clearState,
  } = useExtraction();
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
      log.warn('Delete failed, restored the record', { type, id, error: result.error });
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
      log.warn('Delete all failed', { type, error: result.error });
      showToast({ type: 'error', message: `Failed to delete ${type}` });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] w-[500px] flex-col items-center justify-center gap-4 bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        <p className="text-muted">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[600px] min-h-[400px] w-[500px] flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="relative border-b-2 border-primary-dark bg-primary p-4 text-white">
        <div className="text-center">
          <h1 className="mb-1 font-heading text-(length:--text-3xl) font-normal tracking-[1px] uppercase">
            Swades Connect
          </h1>
          <p className="font-body text-(length:--text-sm) opacity-90">Odoo CRM Extractor</p>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 flex cursor-pointer items-center p-1 text-white opacity-80 [transition:opacity_0.2s] hover:opacity-100"
          title="Settings"
        >
          <SettingsIcon size={20} />
        </button>
      </header>

      {/* Status Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-accent px-4 py-3">
        <SyncStatus lastSync={data?.lastSync} />
        <ExtractButton isLoading={isExtracting} onClick={handleExtract} />
      </div>

      {/* Status Messages */}
      {(storageError || extractionError) && (
        <div className={`${bannerClassName} border-[#dc2626] bg-[#fee2e2] text-[#991b1b]`}>
          <AlertCircle size={16} className="shrink-0" />
          <span>{storageError || extractionError}</span>
        </div>
      )}

      {success && (
        <div className={`${bannerClassName} border-[#16a34a] bg-[#dcfce7] text-[#166534]`}>
          <CheckCircle size={16} className="shrink-0" />
          <span>Extracted {recordsExtracted} records</span>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
