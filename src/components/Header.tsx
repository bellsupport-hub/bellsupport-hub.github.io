import { ExternalLink, Mail, RefreshCw, WifiOff } from 'lucide-react';
import type { DataSource, SeasonArchive, SeasonId } from '../types';
import { formatUpdatedAt } from '../utils/format';

interface HeaderProps {
  seasons: SeasonArchive[];
  selectedSeasonId: SeasonId;
  onSelectSeason: (seasonId: SeasonId) => void;
  updatedAt: string;
  source: DataSource;
  isLoading: boolean;
  isOfflineError: boolean;
  onRefresh: () => void;
  onOpenContact: () => void;
}

export function Header({
  seasons,
  selectedSeasonId,
  onSelectSeason,
  updatedAt,
  source,
  isLoading,
  isOfflineError,
  onRefresh,
  onOpenContact,
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
            </div>
            <div className="brand-sub-row">
              <p className="unofficial-label">※非公式サポーターアプリ</p>
              <a
                href="https://www.bellmare.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="official-site-link"
              >
                <span>ベルマーレ公式</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>

        <div className="header-actions">
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

          <button
            type="button"
            className="contact-header-btn"
            onClick={onOpenContact}
            aria-label="お問い合わせ・情報提供"
            title="お問い合わせ・情報提供"
          >
            <Mail size={15} />
            <span>問合せ</span>
          </button>
        </div>
      </div>

      {/* 5-Season Selector Strip */}
      <div className="season-strip" role="tablist" aria-label="シーズン切替">
        {seasons.map((s) => {
          const isActive = s.id === selectedSeasonId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`season-strip-pill num-font ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectSeason(s.id)}
            >
              <span>{s.label}</span>
              <span className="season-strip-rank">{s.summary.rank}位</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
