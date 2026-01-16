import { useState, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import type { Opportunity } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';

interface OpportunitiesTabProps {
  opportunities: Opportunity[];
  onDelete: (id: string) => void;
}

function OpportunitiesTab({ opportunities, onDelete }: OpportunitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');

  const uniqueStages = useMemo(() => {
    const stages = new Set(opportunities.map((opp) => opp.stage));
    return Array.from(stages).sort();
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        opp.name.toLowerCase().includes(query) ||
        opp.stage.toLowerCase().includes(query);
      const matchesStage = !stageFilter || opp.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [opportunities, searchQuery, stageFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <SearchBox
        placeholder="Search by name or stage..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={filteredOpportunities.length}
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

      {filteredOpportunities.length === 0 ? (
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
            { key: 'name', label: 'Name' },
            { key: 'stage', label: 'Stage' },
            { key: 'revenue', label: 'Revenue', format: (v) => `$${v?.toLocaleString() ?? 0}` },
            { key: 'probability', label: 'Prob.', format: (v) => `${v ?? 0}%` },
          ]}
          data={filteredOpportunities}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export default OpportunitiesTab;
