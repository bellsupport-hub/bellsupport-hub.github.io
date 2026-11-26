import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Play, Search, User, X } from 'lucide-react';
import type { Match, Player, SeasonArchive, SeasonId, VideoItem, VideoSource } from '../types';

interface VideosTabProps {
  videos: VideoItem[];
  seasons: Record<SeasonId, SeasonArchive>;
  seasonOrder: SeasonId[];
  initialPlayerIdFilter: string | null;
  onClearPlayerFilter: () => void;
  onOpenMatch: (match: Match, seasonId: SeasonId) => void;
  onJumpToPlayer: (playerId: string, preferredSeasonId: SeasonId) => void;
}

type SourceFilter = 'all' | VideoSource;
type SeasonFilter = 'all' | SeasonId;

export function VideosTab({
  videos,
  seasons,
  seasonOrder,
  initialPlayerIdFilter,
  onClearPlayerFilter,
  onOpenMatch,
  onJumpToPlayer,
}: VideosTabProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [playingIds, setPlayingIds] = useState<Set<string>>(() => new Set());

  const playerDirectory = useMemo(() => {
    const map = new Map<string, { player: Player; seasonId: SeasonId }>();
    for (const sId of seasonOrder) {
      const archive = seasons[sId];
      if (!archive) continue;
      for (const p of archive.players) {
        if (!map.has(p.id)) {
          map.set(p.id, { player: p, seasonId: sId });
        }
      }
    }
    return map;
  }, [seasons, seasonOrder]);

  const matchDirectory = useMemo(() => {
    const map = new Map<string, { match: Match; season: SeasonArchive }>();
    for (const sId of seasonOrder) {
      const archive = seasons[sId];
      if (!archive) continue;
      for (const m of archive.matches) {
        map.set(m.id, { match: m, season: archive });
      }
    }
    return map;
  }, [seasons, seasonOrder]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      for (const t of v.tags) set.add(t);
    }
    return ['ALL', ...Array.from(set)];
  }, [videos]);

  const activePlayerEntry = initialPlayerIdFilter
    ? playerDirectory.get(initialPlayerIdFilter)
    : null;

  const filteredVideos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...videos]
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .filter((v) => {
        if (sourceFilter !== 'all' && v.source !== sourceFilter) return false;
        if (seasonFilter !== 'all' && v.season !== seasonFilter) return false;
        if (tagFilter !== 'ALL' && !v.tags.includes(tagFilter)) return false;
        if (initialPlayerIdFilter && !v.player_ids.includes(initialPlayerIdFilter)) {
          return false;
        }
        if (!normalized) return true;
        const playerNames = v.player_ids
          .map((pid) => playerDirectory.get(pid)?.player.name ?? '')
          .join(' ');
        const haystack = `${v.title} ${v.channel_name} ${v.tags.join(' ')} ${playerNames}`.toLowerCase();
        return haystack.includes(normalized);
      });
  }, [videos, sourceFilter, seasonFilter, tagFilter, initialPlayerIdFilter, query, playerDirectory]);

  const handlePlay = (id: string) => {
    setPlayingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="tab-content">
      <section className="section-block" aria-labelledby="videos-heading">
        <div className="section-header">
          <h2 id="videos-heading" className="section-title">
            公式ハイライト＆動画
          </h2>
          <span className="section-meta num-font">{filteredVideos.length}件</span>
        </div>

        {activePlayerEntry && (
          <div className="video-player-filter-banner">
            <span>
              選手フィルタ中: <strong>{activePlayerEntry.player.name}</strong>
            </span>
            <button
              type="button"
              className="video-filter-clear-btn"
              onClick={onClearPlayerFilter}
            >
              解除 <X size={13} />
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="search-input-wrap">
          <Search size={17} className="search-icon" />
          <input
            type="search"
            id="video-search-input"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="対戦相手・選手名・タグで動画を検索"
            aria-label="動画を検索"
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

        {/* Source & Season Filter */}
        <div className="filter-pills" role="tablist" aria-label="動画チャンネルフィルタ">
          {(
            [
              { id: 'all', label: 'すべて' },
              { id: 'bellmare', label: 'ベルマーレ公式' },
              { id: 'jleague', label: 'Jリーグ公式' },
            ] as { id: SourceFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={sourceFilter === opt.id}
              className={`filter-pill ${sourceFilter === opt.id ? 'is-active' : ''}`}
              onClick={() => setSourceFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}

          <select
            aria-label="動画シーズン絞り込み"
            className="video-season-select num-font"
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value as SeasonFilter)}
          >
            <option value="all">全シーズン</option>
            {seasonOrder.map((sId) => (
              <option key={sId} value={sId}>
                {seasons[sId]?.label ?? sId}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter Pills */}
        <div className="video-tag-strip" role="tablist" aria-label="動画タグフィルタ">
          {allTags.map((tag) => {
            const isActive = tagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`video-tag-pill ${isActive ? 'is-active' : ''}`}
                onClick={() => setTagFilter(tag)}
              >
                {tag === 'ALL' ? '全タグ' : `#${tag}`}
              </button>
            );
          })}
        </div>

        {/* Video Cards */}
        {filteredVideos.length > 0 ? (
          <div className="videos-list">
            {filteredVideos.map((v) => {
              const isPlaying = playingIds.has(v.id);
              const linkedMatch = v.match_id ? matchDirectory.get(v.match_id) : null;
              return (
                <article key={v.id} className="surface-card video-card">
                  <div className="video-embed-frame">
                    {isPlaying ? (
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0`}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="video-poster">
                        <span className="video-poster-channel">
                          {v.channel_name} · {v.published_at}
                        </span>
                        <p className="video-poster-title">{v.title}</p>
                        <div className="video-poster-actions">
                          <button
                            type="button"
                            className="video-play-btn"
                            onClick={() => handlePlay(v.id)}
                          >
                            <Play size={14} /> 埋め込み再生
                          </button>
                          <a
                            href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="video-yt-link"
                          >
                            YouTube <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="video-card-body">
                    <div className="video-card-meta">
                      <span className={`video-source-badge is-${v.source}`}>
                        {v.source === 'bellmare' ? 'ベルマーレ公式' : 'Jリーグ公式'}
                      </span>
                      <span className="video-season-badge num-font">
                        {seasons[v.season]?.label ?? v.season}
                      </span>
                      <span className="video-date num-font">{v.published_at}</span>
                    </div>

                    <h3 className="video-card-title">{v.title}</h3>

                    <div className="video-card-tags">
                      {v.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="video-tag-chip"
                          onClick={() => setTagFilter(tagFilter === tag ? 'ALL' : tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>

                    {(linkedMatch || v.player_ids.length > 0) && (
                      <div className="video-cross-links">
                        {linkedMatch && (
                          <button
                            type="button"
                            className="cross-link-btn is-match"
                            onClick={() =>
                              onOpenMatch(linkedMatch.match, linkedMatch.season.id)
                            }
                          >
                            <CalendarDays size={13} />
                            <span>
                              {linkedMatch.season.label} {linkedMatch.match.round} vs{' '}
                              {linkedMatch.match.opponent}
                            </span>
                          </button>
                        )}
                        {v.player_ids.map((pid) => {
                          const entry = playerDirectory.get(pid);
                          if (!entry) return null;
                          return (
                            <button
                              key={pid}
                              type="button"
                              className="cross-link-btn is-player"
                              onClick={() => onJumpToPlayer(pid, v.season)}
                            >
                              <User size={13} />
                              <span>{entry.player.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-card">条件に一致する動画がありません。</div>
        )}
      </section>
    </div>
  );
}
