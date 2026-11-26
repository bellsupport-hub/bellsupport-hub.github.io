import { useMemo, useState } from 'react';
import { PlaySquare, Search, X } from 'lucide-react';
import type { Player, PlayerPosition, VideoItem } from '../types';

type PositionFilter = 'ALL' | PlayerPosition;

interface PlayersTabProps {
  players: Player[];
  seasonLabel: string;
  videos: VideoItem[];
  highlightedPlayerId: string | null;
  onViewPlayerVideos: (playerId: string) => void;
}

const POSITION_OPTIONS: { id: PositionFilter; label: string }[] = [
  { id: 'ALL', label: 'すべて' },
  { id: 'GK', label: 'GK' },
  { id: 'DF', label: 'DF' },
  { id: 'MF', label: 'MF' },
  { id: 'FW', label: 'FW' },
];

export function PlayersTab({
  players,
  seasonLabel,
  videos,
  highlightedPlayerId,
  onViewPlayerVideos,
}: PlayersTabProps) {
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL');
  const [query, setQuery] = useState('');

  const videoCountByPlayerId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of videos) {
      for (const pid of v.player_ids) {
        counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
    }
    return counts;
  }, [videos]);

  const filteredPlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...players]
      .sort((a, b) => a.number - b.number)
      .filter((p) => {
        if (posFilter !== 'ALL' && p.position !== posFilter) return false;
        if (!normalized) return true;
        return (
          String(p.number).includes(normalized) ||
          p.name.toLowerCase().includes(normalized) ||
          p.kana.toLowerCase().includes(normalized)
        );
      });
  }, [players, posFilter, query]);

  return (
    <div className="tab-content">
      <section className="section-block" aria-labelledby="players-heading">
        <div className="section-header">
          <h2 id="players-heading" className="section-title">
            選手名鑑（{seasonLabel}）
          </h2>
          <span className="section-meta num-font">{filteredPlayers.length}名表示</span>
        </div>

        {/* Search Box */}
        <div className="search-input-wrap">
          <Search size={17} className="search-icon" />
          <input
            type="search"
            id="player-search-input"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="背番号・選手名・カナで検索"
            aria-label="選手を検索"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="検索をクリア"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Position Filter */}
        <div className="filter-pills" role="tablist" aria-label="ポジションフィルタ">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              id={`pos-filter-${opt.id.toLowerCase()}`}
              role="tab"
              aria-selected={posFilter === opt.id}
              className={`filter-pill ${posFilter === opt.id ? 'is-active' : ''}`}
              onClick={() => setPosFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Player Cards Grid */}
        {filteredPlayers.length > 0 ? (
          <div className="players-list">
            {filteredPlayers.map((player) => {
              const videoCount = videoCountByPlayerId.get(player.id) ?? 0;
              const isHighlighted = highlightedPlayerId === player.id;
              return (
                <article
                  key={`${player.id}-${player.number}`}
                  className={`surface-card player-card ${isHighlighted ? 'is-highlighted' : ''}`}
                >
                  <div className={`player-number-badge pos-${player.position.toLowerCase()}`}>
                    <span className="player-pos-tag">{player.position}</span>
                    <strong className="player-num num-font">{player.number}</strong>
                  </div>

                  <div className="player-info">
                    <div className="player-name-block">
                      <h3 className="player-name">{player.name}</h3>
                      {player.kana && <p className="player-kana">{player.kana}</p>}
                    </div>
                    {(player.height > 0 || player.weight > 0) && (
                      <p className="player-physical num-font">
                        {player.height > 0 ? `${player.height}cm` : '-'} /{' '}
                        {player.weight > 0 ? `${player.weight}kg` : '-'}
                      </p>
                    )}
                    {videoCount > 0 && (
                      <button
                        type="button"
                        className="player-video-link-btn"
                        onClick={() => onViewPlayerVideos(player.id)}
                      >
                        <PlaySquare size={12} />
                        <span>関連動画 {videoCount}件</span>
                      </button>
                    )}
                  </div>

                  <div className="player-stats" aria-label="シーズン成績">
                    <div className="p-stat">
                      <span className="p-stat-label">出場</span>
                      <strong className="p-stat-val num-font">{player.apps}</strong>
                    </div>
                    <div className="p-stat">
                      <span className="p-stat-label">得点</span>
                      <strong className="p-stat-val num-font is-accent">{player.goals}</strong>
                    </div>
                    <div className="p-stat">
                      <span className="p-stat-label">アシスト</span>
                      <strong className="p-stat-val num-font">{player.assists}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-card">条件に一致する選手が見つかりません。</div>
        )}
      </section>
    </div>
  );
}
