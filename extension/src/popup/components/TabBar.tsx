export type TabId = 'main' | 'settings' | 'account';

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'main', label: 'Main', icon: '🤖' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'account', label: 'Account', icon: '👤' },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div class="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          class={`tab-item ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span class="tab-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
