import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Ticket,
  Trophy,
} from 'lucide-react';
import type { Match, StandingsData } from '../types';
import {
  formatKickoffDate,
  formatKickoffTime,
  formatUpdatedAt,
  getMatchOutcome,
  getOutcomeLabel,
} from '../utils/format';

interface HomeTabProps {
  matches: Match[];
  standings: StandingsData;
  updatedAt: string;
  onSelectMatch: (match: Match) => void;
  onGoToMatches: () => void;
}

export function HomeTab({
  matches,
  standings,
  updatedAt,
  onSelectMatch,
  onGoToMatches,
}: HomeTabProps) {
  const [showAllStandings, setShowAllStandings] = useState(false);

  const nextMatch = useMemo(() => {
    const scheduled = matches
      .filter((m) => m.status === 'scheduled')
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    return scheduled[0] ?? null;
  }, [matches]);

  const finishedMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === 'finished' && m.result)
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  }, [matches]);

  const visibleStandings = useMemo(() => {
    if (showAllStandings || standings.standings.length <= 4) {
      return standings.standings;
    }
    const targetIdx = standings.standings.findIndex((row) => row.is_target);
    if (targetIdx === -1) return standings.standings.slice(0, 4);
    const start = Math.max(0, Math.min(targetIdx - 1, standings.standings.length - 4));
    return standings.standings.slice(start, start + 4);
  }, [standings.standings, showAllStandings]);

  const targetStanding = standings.standings.find((row) => row.is_target);

  return (
    <div className="tab-content">
      {/* Next Match Hero Card */}
      <section className="section-block" aria-labelledby="next-match-heading">
        <div className="section-header">
          <h2 id="next-match-heading" className="section-title">
            NEXT MATCH
          </h2>
          <span className="section-meta num-font">
            更新 {formatUpdatedAt(updatedAt)}
          </span>
        </div>

        {nextMatch ? (
          <article className="next-match-card">
            <div className="next-match-top">
              <div className="match-badges">
                <span className="round-pill">{nextMatch.round}</span>
                <span className={`ha-pill ${nextMatch.is_home ? 'is-home' : 'is-away'}`}>
                  {nextMatch.is_home ? 'HOME' : 'AWAY'}
                </span>
              </div>
              <div className="kickoff-pill num-font">
                <Clock size={14} />
                <span>
                  {formatKickoffDate(nextMatch.kickoff)} {formatKickoffTime(nextMatch.kickoff)}
                </span>
              </div>
            </div>

            <div className="matchup-box">
              <div className="team-side">
                <span className="team-label">{nextMatch.is_home ? 'HOME' : 'AWAY'}</span>
                <strong className="team-name is-bellmare">湘南ベルマーレ</strong>
              </div>
              <div className="vs-divider num-font" aria-hidden="true">
                VS
              </div>
              <div className="team-side team-side-right">
                <span className="team-label">{nextMatch.is_home ? 'AWAY' : 'HOME'}</span>
                <strong className="team-name">{nextMatch.opponent}</strong>
              </div>
            </div>

            <div className="next-match-venue">
              <MapPin size={15} />
              <span>{nextMatch.stadium}</span>
            </div>

            <div className="next-match-actions">
              {nextMatch.ticket_url && (
                <a
                  href={nextMatch.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary-accent"
                >
                  <Ticket size={16} />
                  <span>チケット予約（Jリーグチケット）</span>
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={() => onSelectMatch(nextMatch)}
              >
                <span>試合詳細</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </article>
        ) : (
          <div className="empty-card">現在予定されている試合データはありません。</div>
        )}
      </section>

      {/* Recent Form Badges */}
      <section className="section-block" aria-labelledby="recent-form-heading">
        <div className="section-header">
          <h2 id="recent-form-heading" className="section-title">
            直近戦績
          </h2>
          <button type="button" className="text-link-btn" onClick={onGoToMatches}>
            <span>全試合を見る</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="surface-card recent-form-card">
          {finishedMatches.length > 0 ? (
            <>
              <div className="form-badges-row" role="list" aria-label="直近試合の勝敗">
                {finishedMatches.slice(0, 5).map((match) => {
                  const outcome = getMatchOutcome(match);
                  if (!outcome) return null;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      className={`form-badge-btn outcome-${outcome.toLowerCase()}`}
                      onClick={() => onSelectMatch(match)}
                      title={`${match.round} vs ${match.opponent} (${getOutcomeLabel(outcome)})`}
                    >
                      <span className="form-letter num-font">{outcome}</span>
                      <span className="form-opponent">{match.opponent}</span>
                      {match.result && (
                        <span className="form-score num-font">
                          {match.result.bellmare_score}-{match.result.opponent_score}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {finishedMatches[0] && finishedMatches[0].result && (
                <button
                  type="button"
                  className="latest-result-strip"
                  onClick={() => onSelectMatch(finishedMatches[0])}
                >
                  <div className="latest-result-meta">
                    <span className="latest-tag">直近結果</span>
                    <span>
                      {finishedMatches[0].round} vs {finishedMatches[0].opponent}
                    </span>
                  </div>
                  <div className="latest-result-score-wrap">
                    <span className="latest-result-score num-font">
                      {finishedMatches[0].result.bellmare_score} -{' '}
                      {finishedMatches[0].result.opponent_score}
                    </span>
                    <ChevronRight size={16} />
                  </div>
                </button>
              )}
            </>
          ) : (
            <p className="muted-note">終了済みの試合結果がまだありません。</p>
          )}
        </div>
      </section>

      {/* Mini Standings Table */}
      <section className="section-block" aria-labelledby="standings-heading">
        <div className="section-header">
          <div className="section-title-group">
            <Trophy size={16} className="section-icon" />
            <h2 id="standings-heading" className="section-title">
              {standings.competition} 順位表
            </h2>
          </div>
          {targetStanding && (
            <span className="rank-summary-chip num-font">
              現在 <strong>{targetStanding.rank}位</strong> / 勝点{' '}
              <strong>{targetStanding.points}</strong>
            </span>
          )}
        </div>

        <div className="surface-card standings-card">
          <div className="table-scroll">
            <table className="standings-table">
              <thead>
                <tr>
                  <th scope="col" className="col-rank">
                    順位
                  </th>
                  <th scope="col" className="col-team">
                    チーム
                  </th>
                  <th scope="col" className="col-num">
                    試合
                  </th>
                  <th scope="col" className="col-num">
                    勝
                  </th>
                  <th scope="col" className="col-num">
                    分
                  </th>
                  <th scope="col" className="col-num">
                    敗
                  </th>
                  <th scope="col" className="col-num">
                    得失
                  </th>
                  <th scope="col" className="col-pts">
                    勝点
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleStandings.map((row) => (
                  <tr
                    key={row.team}
                    className={row.is_target ? 'is-target-row' : undefined}
                  >
                    <td className="col-rank num-font">
                      <span className={`rank-num ${row.rank <= 2 ? 'is-promo' : ''}`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="col-team">
                      <span className="team-cell-name">
                        {row.is_target && <span className="target-dot" aria-hidden="true" />}
                        {row.team}
                      </span>
                    </td>
                    <td className="col-num num-font">{row.played}</td>
                    <td className="col-num num-font">{row.won}</td>
                    <td className="col-num num-font">{row.drawn}</td>
                    <td className="col-num num-font">{row.lost}</td>
                    <td className="col-num num-font">
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className="col-pts num-font">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {standings.standings.length > 4 && (
            <button
              type="button"
              id="toggle-standings-btn"
              className="expand-table-btn"
              onClick={() => setShowAllStandings((prev) => !prev)}
            >
              {showAllStandings ? (
                <>
                  <span>順位表を折りたたむ</span>
                  <ChevronUp size={16} />
                </>
              ) : (
                <>
                  <span>全順位を展開する（全{standings.standings.length}チーム）</span>
                  <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
