import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  MapPin,
  Ticket,
} from 'lucide-react';
import type { AttendanceSummary } from '../hooks/useAttendance';
import type { Match } from '../types';
import {
  formatKickoffDate,
  formatKickoffTime,
  getMatchOutcome,
  getOutcomeLabel,
} from '../utils/format';

type MatchFilter = 'all' | 'scheduled' | 'finished' | 'attended';

interface MatchesTabProps {
  matches: Match[];
  isAttended: (matchId: string) => boolean;
  onToggleAttended: (matchId: string) => void;
  attendanceSummary: AttendanceSummary;
  onSelectMatch: (match: Match) => void;
}

const FILTER_OPTIONS: { id: MatchFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'scheduled', label: '予定' },
  { id: 'finished', label: '結果' },
  { id: 'attended', label: '観戦済' },
];

export function MatchesTab({
  matches,
  isAttended,
  onToggleAttended,
  attendanceSummary,
  onSelectMatch,
}: MatchesTabProps) {
  const [filter, setFilter] = useState<MatchFilter>('all');

  const sortedMatches = useMemo(() => {
    return [...matches].sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()
    );
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return sortedMatches.filter((m) => {
      if (filter === 'scheduled') return m.status === 'scheduled';
      if (filter === 'finished') return m.status === 'finished';
      if (filter === 'attended') return isAttended(m.id);
      return true;
    });
  }, [sortedMatches, filter, isAttended]);

  return (
    <div className="tab-content">
      {/* Personal Attendance Record Summary */}
      <section className="section-block" aria-labelledby="attendance-summary-heading">
        <div className="attendance-summary-card">
          <div className="attendance-summary-top">
            <div>
              <h2 id="attendance-summary-heading" className="attendance-title">
                MY 現地観戦レコード
              </h2>
              <p className="attendance-sub">
                観戦済トグルで勝敗・勝率を自動集計（端末に保存）
              </p>
            </div>
            <div className="win-rate-pill">
              <span className="win-rate-label">勝率</span>
              <strong className="win-rate-value num-font">
                {attendanceSummary.winRate}%
              </strong>
            </div>
          </div>

          <div className="attendance-stats-row">
            <div className="att-stat">
              <span className="att-stat-label">観戦数</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.totalAttended}
              </strong>
            </div>
            <div className="att-stat is-win">
              <span className="att-stat-label">勝</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.wins}
              </strong>
            </div>
            <div className="att-stat is-draw">
              <span className="att-stat-label">分</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.draws}
              </strong>
            </div>
            <div className="att-stat is-loss">
              <span className="att-stat-label">敗</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.losses}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Pills */}
      <section className="section-block" aria-label="試合一覧">
        <div className="filter-pills" role="tablist" aria-label="試合フィルタ">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              id={`match-filter-${opt.id}`}
              role="tab"
              aria-selected={filter === opt.id}
              className={`filter-pill ${filter === opt.id ? 'is-active' : ''}`}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Match List */}
        {filteredMatches.length > 0 ? (
          <div className="match-list">
            {filteredMatches.map((match) => {
              const attended = isAttended(match.id);
              const outcome = getMatchOutcome(match);

              return (
                <article key={match.id} className="surface-card match-card">
                  <div className="match-card-head">
                    <div className="match-card-meta">
                      <span className="round-chip">{match.round}</span>
                      <span className={`ha-pill-sm ${match.is_home ? 'is-home' : 'is-away'}`}>
                        {match.is_home ? 'HOME' : 'AWAY'}
                      </span>
                      <span className="match-date num-font">
                        {formatKickoffDate(match.kickoff)} {formatKickoffTime(match.kickoff)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`attend-toggle-btn ${attended ? 'is-attended' : ''}`}
                      onClick={() => onToggleAttended(match.id)}
                      aria-pressed={attended}
                    >
                      {attended ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      <span>{attended ? '観戦済' : '観戦記録'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="match-card-main"
                    onClick={() => onSelectMatch(match)}
                  >
                    <div className="match-card-teams">
                      <div className="match-opponent-row">
                        <span className="vs-prefix">vs</span>
                        <strong className="match-opponent-name">{match.opponent}</strong>
                        {outcome && (
                          <span className={`outcome-tag outcome-${outcome.toLowerCase()}`}>
                            {getOutcomeLabel(outcome)}
                          </span>
                        )}
                      </div>
                      <div className="match-venue-line">
                        <MapPin size={13} />
                        <span>{match.stadium}</span>
                      </div>
                    </div>

                    <div className="match-card-right">
                      {match.result ? (
                        <span className="match-score-display num-font">
                          {match.result.bellmare_score} - {match.result.opponent_score}
                        </span>
                      ) : (
                        <span className="match-status-scheduled">予定</span>
                      )}
                      <ChevronRight size={18} className="chevron-muted" />
                    </div>
                  </button>

                  {match.ticket_url && (
                    <div className="match-card-footer">
                      <a
                        href={match.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="match-ticket-link"
                      >
                        <Ticket size={14} />
                        <span>チケット予約</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-card">
            {filter === 'attended'
              ? 'まだ「観戦済」の試合がありません。試合カードの「観戦記録」ボタンをタップして記録しましょう。'
              : '該当する試合がありません。'}
          </div>
        )}
      </section>
    </div>
  );
}
