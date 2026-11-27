import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  MonitorPlay,
  Ticket,
} from 'lucide-react';
import type { AttendanceSummary } from '../hooks/useAttendance';
import type { Match, WatchMode, WatchStatus } from '../types';
import {
  formatKickoffDate,
  formatKickoffTime,
  getMatchOutcome,
  getOutcomeLabel,
} from '../utils/format';
import { TeamFlag, VenuePin } from './TeamFlag';

type MatchFilter = 'all' | 'scheduled' | 'finished' | 'stadium' | 'online' | 'watched';

interface MatchesTabProps {
  matches: Match[];
  getWatchStatus: (matchId: string) => WatchStatus;
  onToggleWatch: (matchId: string, mode: WatchMode) => void;
  attendanceSummary: AttendanceSummary;
  onSelectMatch: (match: Match) => void;
}

export function MatchesTab({
  matches,
  getWatchStatus,
  onToggleWatch,
  attendanceSummary,
  onSelectMatch,
}: MatchesTabProps) {
  const [filter, setFilter] = useState<MatchFilter>('all');

  const sortedMatches = useMemo(() => {
    return [...matches].sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()
    );
  }, [matches]);

  const seasonWatchCounts = useMemo(() => {
    let stadium = 0;
    let online = 0;
    let any = 0;
    for (const m of matches) {
      const w = getWatchStatus(m.id);
      if (w.stadium) stadium += 1;
      if (w.online) online += 1;
      if (w.stadium || w.online) any += 1;
    }
    return { stadium, online, any };
  }, [matches, getWatchStatus]);

  const filterOptions: { id: MatchFilter; label: string }[] = [
    { id: 'all', label: `すべて (${matches.length})` },
    { id: 'scheduled', label: '予定' },
    { id: 'finished', label: '結果' },
    { id: 'stadium', label: `現地 (${seasonWatchCounts.stadium})` },
    { id: 'online', label: `オンライン (${seasonWatchCounts.online})` },
    { id: 'watched', label: `観戦済 (${seasonWatchCounts.any})` },
  ];

  const filteredMatches = useMemo(() => {
    return sortedMatches.filter((m) => {
      const w = getWatchStatus(m.id);
      if (filter === 'scheduled') return m.status === 'scheduled';
      if (filter === 'finished') return m.status === 'finished';
      if (filter === 'stadium') return w.stadium;
      if (filter === 'online') return w.online;
      if (filter === 'watched') return w.stadium || w.online;
      return true;
    });
  }, [sortedMatches, filter, getWatchStatus]);

  return (
    <div className="tab-content">
      {/* Personal Attendance Record Summary */}
      <section className="section-block" aria-labelledby="attendance-summary-heading">
        <div className="attendance-summary-card">
          <div className="attendance-summary-top">
            <div>
              <h2 id="attendance-summary-heading" className="attendance-title">
                MY 観戦レコード（通算）
              </h2>
              <p className="attendance-sub">
                現地・オンライン観戦を記録（端末に自動保存）
              </p>
            </div>
            <div className="win-rate-pill">
              <span className="win-rate-label">現地勝率</span>
              <strong className="win-rate-value num-font">
                {attendanceSummary.winRate}%
              </strong>
            </div>
          </div>

          <div className="attendance-stats-row attendance-stats-5">
            <div className="att-stat">
              <span className="att-stat-label">現地</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.stadiumTotal}
              </strong>
            </div>
            <div className="att-stat is-online">
              <span className="att-stat-label">オンライン</span>
              <strong className="att-stat-num num-font">
                {attendanceSummary.onlineTotal}
              </strong>
            </div>
            <div className="att-stat is-win">
              <span className="att-stat-label">現地勝</span>
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
          {filterOptions.map((opt) => (
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
              const watch = getWatchStatus(match.id);
              const outcome = getMatchOutcome(match);

              return (
                <article key={match.id} className="surface-card match-card">
                  <div className="match-card-head">
                    <div className="match-card-meta">
                      <span className="round-chip">{match.round}</span>
                      <span className="match-date num-font">
                        {formatKickoffDate(match.kickoff)} {formatKickoffTime(match.kickoff)}
                      </span>
                    </div>

                    <div className="watch-toggle-group">
                      <button
                        type="button"
                        className={`attend-toggle-btn ${watch.stadium ? 'is-attended' : ''}`}
                        onClick={() => onToggleWatch(match.id, 'stadium')}
                        aria-pressed={watch.stadium}
                      >
                        <CheckCircle2 size={13} />
                        <span>現地</span>
                      </button>
                      <button
                        type="button"
                        className={`attend-toggle-btn is-online-btn ${watch.online ? 'is-online-active' : ''}`}
                        onClick={() => onToggleWatch(match.id, 'online')}
                        aria-pressed={watch.online}
                      >
                        <MonitorPlay size={13} />
                        <span>オンライン</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="match-card-main"
                    onClick={() => onSelectMatch(match)}
                  >
                    <div className="match-card-teams">
                      <div className="match-opponent-row">
                        <span className="vs-prefix">VS</span>
                        <TeamFlag team={match.opponent} size={15} />
                        <strong className="match-opponent-name">{match.opponent}</strong>
                        {outcome && (
                          <span className={`outcome-tag outcome-${outcome.toLowerCase()}`}>
                            {getOutcomeLabel(outcome)}
                          </span>
                        )}
                      </div>
                      <div className="match-venue-line">
                        <VenuePin isHome={match.is_home} stadium={match.stadium} />
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
          <div className="empty-card">該当する試合がありません。</div>
        )}
      </section>
    </div>
  );
}
