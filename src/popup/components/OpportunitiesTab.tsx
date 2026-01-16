import { useState, useMemo } from 'react';
import { Briefcase, Download, Trash2 } from 'lucide-react';
import type { Opportunity } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';
import { exportData } from '../../shared/export';
import { downloadFile } from '../../shared/download';
import { useToast } from '../hooks/useToast';

interface OpportunitiesTabProps {
  opportunities: Opportunity[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

function OpportunitiesTab({ opportunities, onDelete, onDeleteAll }: OpportunitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [probMin, setProbMin] = useState<string>('');
  const [probMax, setProbMax] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { showToast } = useToast();

  const handleExport = (format: 'csv' | 'json') => {
    const content = exportData('opportunities', opportunities, format);
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    const ext = format === 'csv' ? 'csv' : 'json';
    downloadFile(`swades-opportunities-${Date.now()}.${ext}`, content, mime);
    showToast({ type: 'success', message: `Exported ${opportunities.length} opportunities as ${format.toUpperCase()}` });
  };

  const uniqueStages = useMemo(() => {
    const stages = new Set(opportunities.map((opp) => opp.stage));
    return Array.from(stages).sort();
  }, [opportunities]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredOpportunities = useMemo(() => {
    const minProb = probMin !== '' ? Number(probMin) : null;
    const maxProb = probMax !== '' ? Number(probMax) : null;

    return opportunities.filter((opp) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        opp.name.toLowerCase().includes(query) ||
        opp.stage.toLowerCase().includes(query);
      const matchesStage = !stageFilter || opp.stage === stageFilter;
      const matchesProbMin = minProb === null || opp.probability >= minProb;
      const matchesProbMax = maxProb === null || opp.probability <= maxProb;
      return matchesSearch && matchesStage && matchesProbMin && matchesProbMax;
    });
  }, [opportunities, searchQuery, stageFilter, probMin, probMax]);

  const sortedOpportunities = useMemo(() => {
    if (!sortKey) return filteredOpportunities;
    return [...filteredOpportunities].sort((a, b) => {
      const aVal = a[sortKey as keyof Opportunity] ?? '';
      const bVal = b[sortKey as keyof Opportunity] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredOpportunities, sortKey, sortDirection]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by name or stage..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={sortedOpportunities.length}
      />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}>
          Stage:
        </label>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">All Stages</option>
          {uniqueStages.map((stage) => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
        }}>
          Probability:
        </label>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Min %"
          value={probMin}
          onChange={(e) => setProbMin(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            outline: 'none',
            width: '60px',
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>to</span>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Max %"
          value={probMax}
          onChange={(e) => setProbMax(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            outline: 'none',
            width: '60px',
          }}
        />
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}>
          Export:
        </label>
        <button
          onClick={() => handleExport('csv')}
          disabled={opportunities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: opportunities.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: opportunities.length === 0 ? 'not-allowed' : 'pointer',
            color: opportunities.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
        >
          <Download size={14} /> CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={opportunities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '0px',
            fontSize: '12px',
            fontWeight: 500,
            background: opportunities.length === 0 ? '#f3f4f6' : 'transparent',
            cursor: opportunities.length === 0 ? 'not-allowed' : 'pointer',
            color: opportunities.length === 0 ? '#9ca3af' : 'var(--color-text)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
        >
          <Download size={14} /> JSON
        </button>
        
        {/* Spacer to push Delete All to the right */}
        <div style={{ flex: 1 }} />
        
        <button
          onClick={onDeleteAll}
          disabled={opportunities.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: opportunities.length === 0 
              ? '#6b7280' 
              : 'linear-gradient(to right, #8B2E2E, #A03535)',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '0px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: opportunities.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: opportunities.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = opportunities.length === 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          }}
          onMouseDown={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onMouseUp={(e) => {
            if (opportunities.length > 0) {
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
        >
          <Trash2 size={18} /> Delete All
        </button>
      </div>

      {sortedOpportunities.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          color: 'var(--color-text-secondary)',
        }}>
          <Briefcase size={48} strokeWidth={1.5} style={{ color: '#d1d5db', marginBottom: '12px' }} />
          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>No opportunities found</p>
          <p style={{ fontSize: '12px' }}>
            {opportunities.length === 0
              ? 'Click "Extract Now" to fetch opportunities from Odoo'
              : 'No opportunities match your filter'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name', sortable: true, width: '35%' },
            { key: 'stage', label: 'Stage', sortable: true, width: '20%' },
            { key: 'revenue', label: 'Revenue', sortable: true, width: '20%', format: (v) => `$${v?.toLocaleString() ?? 0}` },
            { key: 'probability', label: 'Prob.', sortable: true, width: '15%', format: (v) => `${v ?? 0}%` },
          ]}
          data={sortedOpportunities}
          onDelete={onDelete}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}
    </div>
  );
}

export default OpportunitiesTab;
