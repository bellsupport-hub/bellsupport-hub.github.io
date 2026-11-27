import { useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  MonitorPlay,
  Ticket,
  X,
} from 'lucide-react';
import type { Match, Player, VideoItem, WatchMode, WatchStatus } from '../types';
import {
  formatKickoffDate,
  formatKickoffTime,
  getMatchOutcome,
  getOutcomeLabel,
} from '../utils/format';
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

function buildFormationRows(formation: string, totalStarters: number) {
  const parts = formation
    .split('-')
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  const outfieldSum = parts.reduce((acc, n) => acc + n, 0);
  const effectiveParts =
    parts.length >= 2 && outfieldSum + 1 === totalStarters ? parts : [3, 1, 4, 2];

  // Build from GK (index 0) upward, then reverse so FW is at top of pitch
  const rows: { label: string; indices: number[] }[] = [{ label: 'GK', indices: [0] }];
  let cursor = 1;
  effectiveParts.forEach((count, rowIdx) => {
    const indices: number[] = [];
    for (let i = 0; i < count && cursor < totalStarters; i += 1) {
      indices.push(cursor);
      cursor += 1;
    }
    rows.push({ label: `LINE-${rowIdx + 1}`, indices });
  });

  return rows.reverse();
}

export function MatchDetailModal({
  match,
  players,
  videos,
  watchStatus,
  onToggleWatch,
  onJumpToPlayer,
  onClose,
}: MatchDetailModalProps) {
  const playerByNumber = useMemo(() => {
    const map = new Map<number, Player>();
    for (const p of players) {
      map.set(p.number, p);
    }
    return map;
  }, [players]);

  useEffect(() => {
    if (!match) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match, onClose]);

  if (!match) return null;

  const outcome = getMatchOutcome(match);

  const getShortName = (num: number) => {
    const found = playerByNumber.get(num);
    if (!found) return `#${num}`;
    return found.name.replace(/（.*?）/g, '').trim();
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
              <span>{match.opponent}</span>
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
                darkBg
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

          {/* 3-1-4-2 Formation Pitch */}
          {match.lineup ? (
            <section className="detail-section">
              <div className="detail-section-header">
                <h3>フォーメーション</h3>
                <span className="formation-badge num-font">{match.lineup.formation}</span>
              </div>

              <div className="pitch-container" aria-label={`フォーメーション ${match.lineup.formation}`}>
                <svg
                  className="pitch-markings"
                  viewBox="0 0 320 420"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <rect x="8" y="8" width="304" height="404" rx="6" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
                  <line x1="8" y1="210" x2="312" y2="210" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
                  <circle cx="160" cy="210" r="42" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
                  <circle cx="160" cy="210" r="3" fill="rgba(255,255,255,0.45)" />
                  <rect x="75" y="8" width="170" height="58" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                  <rect x="115" y="8" width="90" height="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                  <rect x="75" y="354" width="170" height="58" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                  <rect x="115" y="390" width="90" height="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                </svg>

                <div className="pitch-rows">
                  {buildFormationRows(
                    match.lineup.formation,
                    match.lineup.starters.length
                  ).map((row) => (
                    <div key={row.label} className={`pitch-row pitch-row-${row.indices.length}`}>
                      {row.indices.map((idx) => {
                        const num = match.lineup?.starters[idx];
                        if (num === undefined) return null;
                        const isGk = row.label === 'GK';
                        return (
                          <div key={`${row.label}-${num}`} className="pitch-player">
                            <span
                              className={`pitch-dot num-font ${isGk ? 'is-gk' : ''}`}
                            >
                              {num}
                            </span>
                            <span className="pitch-name">{getShortName(num)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {match.lineup.substitutes.length > 0 && (
                <div className="subs-box">
                  <span className="subs-label">控えメンバー</span>
                  <div className="subs-chips">
                    {match.lineup.substitutes.map((num) => (
                      <span key={num} className="sub-chip">
                        <strong className="num-font">#{num}</strong>
                        <span>{getShortName(num)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="detail-section">
              <div className="detail-placeholder">
                スターティングメンバー・フォーメーションは試合当日に公開されます。
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

          {/* Linked Official Videos */}
          {videos.length > 0 && (
            <section className="detail-section">
              <div className="detail-section-header">
                <h3>関連公式動画（{videos.length}件）</h3>
              </div>
              <div className="modal-videos-list">
                {videos.map((v) => (
                  <div key={v.id} className="modal-video-card">
                    <div className="video-embed-frame">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?rel=0`}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
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
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
