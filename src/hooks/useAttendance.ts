import { useCallback, useMemo, useState } from 'react';
import type { Match, WatchMode, WatchStatus } from '../types';
import { getMatchOutcome } from '../utils/format';

const LEGACY_KEY = 'bellsupport_hub_attended_matches_v1';
const WATCH_LOG_KEY = 'bellsupport_hub_watch_log_v2';

type WatchLogMap = Record<string, WatchStatus>;

function loadWatchLog(): WatchLogMap {
  try {
    const raw = window.localStorage.getItem(WATCH_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WatchLogMap;
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // Migrate legacy stadium-only attendance records
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacyIds = JSON.parse(legacyRaw);
      if (Array.isArray(legacyIds)) {
        const migrated: WatchLogMap = {};
        for (const id of legacyIds) {
          if (typeof id === 'string') {
            migrated[id] = { stadium: true, online: false };
          }
        }
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
}

export interface AttendanceSummary {
  stadiumTotal: number;
  onlineTotal: number;
  anyTotal: number;
  finishedStadium: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export function useAttendance(matches: Match[]) {
  const [watchLog, setWatchLog] = useState<WatchLogMap>(() =>
    typeof window !== 'undefined' ? loadWatchLog() : {}
  );

  const toggleWatch = useCallback((matchId: string, mode: WatchMode) => {
    setWatchLog((prev) => {
      const current = prev[matchId] ?? { stadium: false, online: false };
      const updated: WatchStatus = {
        ...current,
        [mode]: !current[mode],
      };
      const next = { ...prev };
      if (!updated.stadium && !updated.online) {
        delete next[matchId];
      } else {
        next[matchId] = updated;
      }
      try {
        window.localStorage.setItem(WATCH_LOG_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const getWatchStatus = useCallback(
    (matchId: string): WatchStatus => watchLog[matchId] ?? { stadium: false, online: false },
    [watchLog]
  );

  const summary = useMemo<AttendanceSummary>(() => {
    let stadiumTotal = 0;
    let onlineTotal = 0;
    let anyTotal = 0;
    let finishedStadium = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const match of matches) {
      const status = watchLog[match.id];
      if (!status) continue;
      if (status.stadium) stadiumTotal += 1;
      if (status.online) onlineTotal += 1;
      if (status.stadium || status.online) anyTotal += 1;

      if (status.stadium) {
        const outcome = getMatchOutcome(match);
        if (outcome) {
          finishedStadium += 1;
          if (outcome === 'W') wins += 1;
          else if (outcome === 'D') draws += 1;
          else losses += 1;
        }
      }
    }

    const winRate = finishedStadium > 0 ? Math.round((wins / finishedStadium) * 100) : 0;

    return {
      stadiumTotal,
      onlineTotal,
      anyTotal,
      finishedStadium,
      wins,
      draws,
      losses,
      winRate,
    };
  }, [matches, watchLog]);

  return {
    watchLog,
    getWatchStatus,
    toggleWatch,
    summary,
  };
}
