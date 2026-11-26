import { RefreshCw, WifiOff } from 'lucide-react';
import type { DataSource } from '../types';
import { formatUpdatedAt } from '../utils/format';

interface HeaderProps {
  season: string;
  updatedAt: string;
  source: DataSource;
  isLoading: boolean;
  isOfflineError: boolean;
  onRefresh: () => void;
}

export function Header({
  season,
  updatedAt,
  source,
  isLoading,
  isOfflineError,
  onRefresh,
}: HeaderProps) {
  const sourceLabel =
    source === 'live'
      ? '最新'
      : source === 'cache'
        ? 'キャッシュ'
        : '初期データ';

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="brand-stripe" aria-hidden="true">
            <span className="stripe-green" />
            <span className="stripe-blue" />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">BellSupport Hub</h1>
              <span className="season-chip num-font">{season}</span>
            </div>
            <p className="unofficial-label">※非公式サポーターアプリ</p>
          </div>
        </div>

        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="最新データを再取得"
          title={`更新: ${formatUpdatedAt(updatedAt)} (${sourceLabel})`}
        >
          {isOfflineError ? (
            <WifiOff size={15} className="refresh-icon" />
          ) : (
            <RefreshCw size={15} className={`refresh-icon ${isLoading ? 'spin' : ''}`} />
          )}
          <span className="refresh-text">{isLoading ? '更新中' : sourceLabel}</span>
        </button>
      </div>
    </header>
  );
}
