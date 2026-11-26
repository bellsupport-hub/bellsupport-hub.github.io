import type { Match, MatchOutcome } from '../types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatKickoffDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}/${day}(${weekday})`;
}

export function formatKickoffTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatUpdatedAt(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export function getMatchOutcome(match: Match): MatchOutcome | null {
  if (match.status !== 'finished' || !match.result) return null;
  if (match.result.bellmare_score > match.result.opponent_score) return 'W';
  if (match.result.bellmare_score < match.result.opponent_score) return 'L';
  return 'D';
}

export function getOutcomeLabel(outcome: MatchOutcome): string {
  if (outcome === 'W') return 'WIN';
  if (outcome === 'D') return 'DRAW';
  return 'LOSE';
}
