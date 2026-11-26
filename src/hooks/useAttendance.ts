import { useCallback, useMemo, useState } from 'react';
import type { Match } from '../types';
import { getMatchOutcome } from '../utils/format';

const ATTENDANCE_KEY = 'bellsupport_hub_attended_matches_v1';

function loadAttendedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export interface AttendanceSummary {
  totalAttended: number;
  finishedAttended: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export function useAttendance(matches: Match[]) {
  const [attendedIds, setAttendedIds] = useState<string[]>(() =>
    typeof window !== 'undefined' ? loadAttendedIds() : []
  );

  const toggleAttended = useCallback((matchId: string) => {
    setAttendedIds((prev) => {
      const exists = prev.includes(matchId);
      const next = exists ? prev.filter((id) => id !== matchId) : [...prev, matchId];
      try {
        window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const isAttended = useCallback(
    (matchId: string) => attendedIds.includes(matchId),
    [attendedIds]
  );

  const summary = useMemo<AttendanceSummary>(() => {
    const attendedMatches = matches.filter((m) => attendedIds.includes(m.id));
    let finishedAttended = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const match of attendedMatches) {
      const outcome = getMatchOutcome(match);
      if (outcome) {
        finishedAttended += 1;
        if (outcome === 'W') wins += 1;
        else if (outcome === 'D') draws += 1;
        else losses += 1;
      }
    }

    const winRate = finishedAttended > 0 ? Math.round((wins / finishedAttended) * 100) : 0;

    return {
      totalAttended: attendedMatches.length,
      finishedAttended,
      wins,
      draws,
      losses,
      winRate,
    };
  }, [matches, attendedIds]);

  return {
    attendedIds,
    toggleAttended,
    isAttended,
    summary,
  };
}
