import { useState, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import type { Opportunity } from '../../shared/types';
import DataTable from './DataTable';
import SearchBox from './SearchBox';
import { EmptyState, ExportBar, FilterRow, FilterSelect } from './TabControls';
import { fieldClassName } from './controlStyles';
import { useExport } from '../hooks/useExport';
import { useSort } from '../hooks/useSort';

interface OpportunitiesTabProps {
  opportunities: Opportunity[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

const probabilityInputClassName = `${fieldClassName} w-[60px]`;

function OpportunitiesTab({ opportunities, onDelete, onDeleteAll }: OpportunitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [probMin, setProbMin] = useState<string>('');
  const [probMax, setProbMax] = useState<string>('');
  const handleExport = useExport('opportunities', opportunities);

  const uniqueStages = useMemo(() => {
    const stages = new Set(opportunities.map((opp) => opp.stage));
    return Array.from(stages).sort();
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    const minProb = probMin !== '' ? Number(probMin) : null;
    const maxProb = probMax !== '' ? Number(probMax) : null;

    return opportunities.filter((opp) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = opp.name.toLowerCase().includes(query) || opp.stage.toLowerCase().includes(query);
      const matchesStage = !stageFilter || opp.stage === stageFilter;
      const matchesProbMin = minProb === null || opp.probability >= minProb;
      const matchesProbMax = maxProb === null || opp.probability <= maxProb;
      return matchesSearch && matchesStage && matchesProbMin && matchesProbMax;
    });
  }, [opportunities, searchQuery, stageFilter, probMin, probMax]);

  const { sorted: sortedOpportunities, sortKey, sortDirection, handleSort } = useSort(filteredOpportunities);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        placeholder="Search by name or stage..."
        value={searchQuery}
        onChange={setSearchQuery}
        count={sortedOpportunities.length}
      />

      <FilterSelect
        label="Stage:"
        value={stageFilter}
        onChange={setStageFilter}
        options={[{ value: '', label: 'All Stages' }, ...uniqueStages.map((stage) => ({ value: stage, label: stage }))]}
      />

      <FilterRow label="Probability:" nowrap>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Min %"
          value={probMin}
          onChange={(e) => setProbMin(e.target.value)}
          className={probabilityInputClassName}
        />
        <span className="text-[12px] text-muted">to</span>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Max %"
          value={probMax}
          onChange={(e) => setProbMax(e.target.value)}
          className={probabilityInputClassName}
        />
      </FilterRow>

      <ExportBar recordCount={opportunities.length} onExport={handleExport} onDeleteAll={onDeleteAll} />

      {sortedOpportunities.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No opportunities found"
          hint={
            opportunities.length === 0
              ? 'Click "Extract Now" to fetch opportunities from Odoo'
              : 'No opportunities match your filter'
          }
        />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name', sortable: true, width: '35%' },
            { key: 'stage', label: 'Stage', sortable: true, width: '20%' },
            {
              key: 'revenue',
              label: 'Revenue',
              sortable: true,
              width: '20%',
              format: (v) => `₹${v?.toLocaleString('en-IN') ?? 0}`,
            },
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
