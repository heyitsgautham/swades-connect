import { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useStorage } from './hooks/useStorage';
import { useExtraction } from './hooks/useExtraction';
import TabNavigation from './components/TabNavigation';
import ContactsTab from './components/ContactsTab';
import OpportunitiesTab from './components/OpportunitiesTab';
import ActivitiesTab from './components/ActivitiesTab';
import SyncStatus from './components/SyncStatus';
import ExtractButton from './components/ExtractButton';
import './index.css';
import './App.css';

type TabType = 'contacts' | 'opportunities' | 'activities';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const { data, loading, error: storageError, deleteRecord, refetch } = useStorage();
  const { isExtracting, error: extractionError, success, recordsExtracted, triggerExtraction, clearState } = useExtraction();

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    clearState();
  };

  const handleExtract = async () => {
    await triggerExtraction();
    setTimeout(() => refetch(), 1000);
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
          margin: '8px 16px 0',
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
          margin: '8px 16px 0',
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
            onDelete={(id) => deleteRecord('contacts', id)}
          />
        )}

        {activeTab === 'opportunities' && (
          <OpportunitiesTab
            opportunities={data?.opportunities || []}
            onDelete={(id) => deleteRecord('opportunities', id)}
          />
        )}

        {activeTab === 'activities' && (
          <ActivitiesTab
            activities={data?.activities || []}
            onDelete={(id) => deleteRecord('activities', id)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
