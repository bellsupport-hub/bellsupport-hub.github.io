import { CalendarDays, Home, MapPin, Users } from 'lucide-react';
import type { TabId } from '../types';

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'ホーム', icon: Home },
  { id: 'matches', label: '試合・観戦', icon: CalendarDays },
  { id: 'players', label: '選手名鑑', icon: Users },
  { id: 'stadium', label: 'スタジアム', icon: MapPin },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      <div className="bottom-nav-inner">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              id={`nav-tab-${id}`}
              className={`nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-indicator" aria-hidden="true" />
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
