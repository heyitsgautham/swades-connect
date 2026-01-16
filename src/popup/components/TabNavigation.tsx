import { Users, Briefcase, Calendar } from 'lucide-react';

type TabType = 'contacts' | 'opportunities' | 'activities';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: TabType; label: string; Icon: typeof Users }[] = [
    { id: 'contacts', label: 'Contacts', Icon: Users },
    { id: 'opportunities', label: 'Opportunities', Icon: Briefcase },
    { id: 'activities', label: 'Activities', Icon: Calendar },
  ];

  return (
    <nav style={{
      display: 'flex',
      borderBottom: '2px solid var(--color-border)',
      background: '#fafbfc',
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: 'none',
              background: isActive ? 'var(--color-accent)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.2s ease',
            }}
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
