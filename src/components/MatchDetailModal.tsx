import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  MonitorPlay,
  Play,
  Ticket,
  X,
} from 'lucide-react';
import type { Match, Player, PlayerPosition, VideoItem, WatchMode, WatchStatus } from '../types';
import {
  formatKickoffDate,
  formatKickoffTime,
  getMatchOutcome,
  getOutcomeLabel,
} from '../utils/format';
import { getTeamFullName } from '../utils/clubMeta';
import { TeamFlag, VenuePin } from './TeamFlag';

interface MatchDetailModalProps {
  match: Match | null;
  players: Player[];
  videos: VideoItem[];
  watchStatus: WatchStatus;
  onToggleWatch: (matchId: string, mode: WatchMode) => void;
  onJumpToPlayer?: (playerId: string) => void;
  onClose: () => void;
}

const POSITION_RANK: Record<PlayerPosition, number> = {
  GK: 0,
  DF: 1,
  MF: 2,
  FW: 3,
};

export function MatchDetailModal({
  match,
  players,
  videos,
  watchStatus,
  onToggleWatch,
  onJumpToPlayer,
  onClose,
}: MatchDetailModalProps) {
  const [playingVideoIds, setPlayingVideoIds] = useState<Set<string>>(() => new Set());

  const playerByNumber = useMemo(() => {
    const map = new Map<number, Player>();
    for (const p of players) {
      map.set(p.number, p);
    }
    return map;
  }, [players]);

  useEffect(() => {
    setPlayingVideoIds(new Set());
  }, [match?.id]);

  useEffect(() => {
    if (!match) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match, onClose]);

  const sortedStarters = useMemo(() => {
    if (!match?.lineup) return [];
    return [...match.lineup.starters].sort((a, b) => {
      const pa = playerByNumber.get(a);
      const pb = playerByNumber.get(b);
      const ra = pa ? POSITION_RANK[pa.position] : 9;
      const rb = pb ? POSITION_RANK[pb.position] : 9;
      if (ra !== rb) return ra - rb;
      return a - b;
    });
  }, [match, playerByNumber]);

  if (!match) return null;

  const outcome = getMatchOutcome(match);

  const getShortName = (num: number) => {
    const found = playerByNumber.get(num);
    if (!found) return `#${num}`;
    return found.name.replace(/（.*?）/g, '').trim();
  };

  const handlePlayVideo = (videoId: string) => {
    setPlayingVideoIds((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-detail-title"
      onClick={onClose}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-kicker">
              <span>{match.round}</span>
              <span>•</span>
              <span className="num-font">
                {formatKickoffDate(match.kickoff)} {formatKickoffTime(match.kickoff)}
              </span>
            </div>
            <h2 id="match-detail-title" className="modal-title team-with-flag">
              <TeamFlag team="湘南ベルマーレ" size={16} />
              <span>湘南ベルマーレ</span>
              <span className="vs-prefix">VS</span>
              <TeamFlag team={match.opponent} size={16} />
              <span>{getTeamFullName(match.opponent)}</span>
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Scoreboard / Status Banner */}
          <div className="detail-score-banner">
            <div className="detail-score-meta">
              <span className={`ha-pill ${match.is_home ? 'is-home' : 'is-away'}`}>
                {match.is_home ? 'HOME' : 'AWAY'}
              </span>
              {outcome && (
                <span className={`outcome-pill outcome-${outcome.toLowerCase()}`}>
                  {getOutcomeLabel(outcome)}
                </span>
              )}
              {match.status === 'scheduled' && (
                <span className="status-pill-scheduled">試合予定</span>
              )}
            </div>

            {match.result ? (
              <div className="detail-score-row">
                <div className="detail-team">湘南</div>
                <div className="detail-score-nums num-font">
                  <span>{match.result.bellmare_score}</span>
                  <span className="score-sep">-</span>
                  <span>{match.result.opponent_score}</span>
                </div>
                <div className="detail-team">{match.opponent}</div>
              </div>
            ) : (
              <div className="detail-kickoff-large num-font">
                KICK OFF {formatKickoffTime(match.kickoff)}
              </div>
            )}

            <div className="detail-stadium-line">
              <VenuePin
                isHome={match.is_home}
                stadium={match.stadium}
                clickable
                showFull
              />
            </div>

            {match.result && match.result.scorers.length > 0 && (
              <div className="detail-scorers">
                <span className="scorers-label">得点</span>
                <div className="scorers-list">
                  {match.result.scorers.map((scorer) => (
                    <span key={scorer} className="scorer-chip">
                      ⚽ {scorer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <a
              href="https://www.jleague.jp/club/shonan/day/"
              target="_blank"
              rel="noopener noreferrer"
              className="jleague-stats-link"
            >
              <span>Jリーグ公式で詳細・スタッツを見る</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Dual Watch Toggles & Ticket Action */}
          <div className="detail-action-row detail-watch-grid">
            <button
              type="button"
              className={`attend-toggle-lg ${watchStatus.stadium ? 'is-attended' : ''}`}
              onClick={() => onToggleWatch(match.id, 'stadium')}
            >
              {watchStatus.stadium ? <CheckCircle2 size={17} /> : <Circle size={17} />}
              <span>{watchStatus.stadium ? '現地観戦済' : '現地観戦を記録'}</span>
            </button>

            <button
              type="button"
              className={`attend-toggle-lg ${watchStatus.online ? 'is-online-active' : ''}`}
              onClick={() => onToggleWatch(match.id, 'online')}
            >
              <MonitorPlay size={17} />
              <span>{watchStatus.online ? 'オンライン観戦済' : 'オンライン観戦'}</span>
            </button>

            {match.ticket_url && (
              <a
                href={match.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-brand-outline"
              >
                <Ticket size={16} />
                <span>チケット</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Verified Lineup List (Starters & Substitutes) */}
          {match.lineup ? (
            <section className="detail-section">
              <div className="detail-section-header">
                <h3>先発メンバー（{sortedStarters.length}名）</h3>
                <span className="section-meta">タップで選手名鑑へ</span>
              </div>

              <div className="lineup-grid">
                {sortedStarters.map((num) => {
                  const p = playerByNumber.get(num);
                  const pos = p?.position ?? '';
                  return (
                    <button
                      key={`starter-${num}`}
                      type="button"
                      className="lineup-player-chip"
                      disabled={!p || !onJumpToPlayer}
                      onClick={() => {
                        if (p && onJumpToPlayer) onJumpToPlayer(p.id);
                      }}
                    >
                      {pos && (
                        <span className={`lineup-pos-tag pos-${pos.toLowerCase()}`}>
                          {pos}
                        </span>
                      )}
                      <strong className="lineup-num num-font">#{num}</strong>
                      <span className="lineup-name">{getShortName(num)}</span>
                    </button>
                  );
                })}
              </div>

              {match.lineup.substitutes.length > 0 && (
                <div className="subs-box">
                  <span className="subs-label">
                    途中出場（{match.lineup.substitutes.length}名）
                  </span>
                  <div className="subs-chips">
                    {match.lineup.substitutes.map((num) => {
                      const p = playerByNumber.get(num);
                      return (
                        <button
                          key={`sub-${num}`}
                          type="button"
                          className="sub-chip sub-chip-btn"
                          disabled={!p || !onJumpToPlayer}
                          onClick={() => {
                            if (p && onJumpToPlayer) onJumpToPlayer(p.id);
                          }}
                        >
                          <strong className="num-font">#{num}</strong>
                          <span>{getShortName(num)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="detail-section">
              <div className="detail-placeholder">
                出場メンバーは試合結果の反映後に表示されます。
              </div>
            </section>
          )}

          {/* Match Stats */}
          {match.stats && (
            <section className="detail-section">
              <div className="detail-section-header">
                <h3>試合スタッツ（湘南）</h3>
              </div>
              <div className="stats-grid">
                <div className="stat-bar-item">
                  <div className="stat-bar-head">
                    <span>ボール支配率</span>
                    <strong className="num-font">{match.stats.possession}%</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill is-green"
                      style={{ width: `${Math.min(100, match.stats.possession)}%` }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-head">
                    <span>シュート数</span>
                    <strong className="num-font">{match.stats.shots}本</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill is-blue"
                      style={{ width: `${Math.min(100, (match.stats.shots / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-head">
                    <span>枠内シュート</span>
                    <strong className="num-font">{match.stats.shots_on_target}本</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill is-green"
                      style={{
                        width: `${Math.min(
                          100,
                          match.stats.shots > 0
                            ? (match.stats.shots_on_target / match.stats.shots) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-head">
                    <span>コーナーキック</span>
                    <strong className="num-font">{match.stats.corners}本</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill is-blue"
                      style={{ width: `${Math.min(100, (match.stats.corners / 12) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Linked Official Videos (with YouTube Thumbnails) */}
          {videos.length > 0 && (
            <section className="detail-section">
              <div className="detail-section-header">
                <h3>関連公式動画（{videos.length}件）</h3>
              </div>
              <div className="modal-videos-list">
                {videos.map((v) => {
                  const isPlaying = playingVideoIds.has(v.id);
                  return (
                    <div key={v.id} className="modal-video-card">
                      <div className="video-embed-frame">
                        {isPlaying ? (
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?autoplay=1&rel=0`}
                            title={v.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <div className="video-poster has-thumb">
                            <img
                              src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                              alt={v.title}
                              loading="lazy"
                              className="video-poster-thumb"
                            />
                            <div className="video-poster-overlay">
                              <button
                                type="button"
                                className="video-play-btn"
                                onClick={() => handlePlayVideo(v.id)}
                              >
                                <Play size={14} /> 埋め込み再生
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="modal-video-meta">
                        <p className="modal-video-title">{v.title}</p>
                        <div className="modal-video-links">
                          {onJumpToPlayer &&
                            v.player_ids.map((pid) => {
                              const found = players.find((p) => p.id === pid);
                              if (!found) return null;
                              return (
                                <button
                                  key={pid}
                                  type="button"
                                  className="cross-link-btn is-player"
                                  onClick={() => onJumpToPlayer(pid)}
                                >
                                  #{found.number} {found.name}
                                </button>
                              );
                            })}
                          <a
                            href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="modal-video-yt-link"
                          >
                            YouTube <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
