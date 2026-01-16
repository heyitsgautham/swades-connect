import { DownloadCloud, Loader2 } from 'lucide-react';

interface ExtractButtonProps {
  isLoading: boolean;
  onClick: () => void;
}

function ExtractButton({ isLoading, onClick }: ExtractButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title={isLoading ? 'Extraction in progress...' : 'Extract data from current Odoo page'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: isLoading 
          ? '#6b7280' 
          : 'linear-gradient(to right, #8B2E2E, #A03535)',
        color: 'white',
        padding: '8px 16px',
        border: 'none',
        borderRadius: '0px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        boxShadow: isLoading ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
        transform: 'scale(1)',
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = isLoading ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      }}
      onMouseDown={(e) => {
        if (!isLoading) {
          e.currentTarget.style.transform = 'scale(0.95)';
        }
      }}
      onMouseUp={(e) => {
        if (!isLoading) {
          e.currentTarget.style.transform = 'scale(1.02)';
        }
      }}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Extracting...</span>
        </>
      ) : (
        <>
          <DownloadCloud size={18} />
          <span>Extract Now</span>
        </>
      )}
    </button>
  );
}

export default ExtractButton;
