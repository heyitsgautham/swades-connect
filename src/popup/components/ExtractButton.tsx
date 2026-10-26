import { DownloadCloud, Loader2 } from 'lucide-react';
import { primaryButtonClassName } from './controlStyles';

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
      className={primaryButtonClassName(isLoading)}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
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
