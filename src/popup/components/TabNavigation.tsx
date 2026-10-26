import { Users, Briefcase, Calendar } from 'lucide-react';
import type { DataType } from '../../shared/messages';

interface TabNavigationProps {
  activeTab: DataType;
  onTabChange: (tab: DataType) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: DataType; label: string; Icon: typeof Users }[] = [
    { id: 'contacts', label: 'Contacts', Icon: Users },
    { id: 'opportunities', label: 'Opportunities', Icon: Briefcase },
    { id: 'activities', label: 'Activities', Icon: Calendar },
  ];

  return (
    <nav className="flex border-b-2 border-border bg-[#fafbfc]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={`-mb-0.5 flex flex-1 cursor-pointer flex-col items-center gap-1 border-b-2 px-2 py-3 text-[12px] [transition:all_0.2s_ease] ${
              isActive
                ? 'border-primary bg-accent font-semibold text-primary'
                : 'border-transparent bg-transparent font-medium text-muted'
            }`}
          >
            <tab.Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default TabNavigation;
