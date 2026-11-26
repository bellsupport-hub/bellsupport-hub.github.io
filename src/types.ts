export type SeasonId = '2026-27' | '2026-special' | '2025' | '2024' | '2023';

export interface SeasonIndexItem {
  id: SeasonId;
  label: string;
  competition: string;
}

export interface MetaData {
  updated_at: string;
  schema_version: number;
  default_season?: SeasonId;
  seasons?: SeasonIndexItem[];
}

export interface StandingRow {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gd: number;
  points: number;
  is_target: boolean;
}

export interface StandingsData {
  season: string;
  competition: string;
  standings: StandingRow[];
}

export interface MatchResult {
  bellmare_score: number;
  opponent_score: number;
  scorers: string[];
}

export interface MatchLineup {
  formation: string;
  starters: number[];
  substitutes: number[];
}

export interface MatchStats {
  possession: number;
  shots: number;
  shots_on_target: number;
  corners: number;
}

export interface Match {
  id: string;
  round: string;
  kickoff: string;
  is_home: boolean;
  opponent: string;
  stadium: string;
  status: 'scheduled' | 'finished';
  ticket_url: string | null;
  result: MatchResult | null;
  lineup: MatchLineup | null;
  stats: MatchStats | null;
}

export interface MatchesData {
  season: string;
  matches: Match[];
}

export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  /** Cross-season stable player ID (e.g., "suzuki-akito") */
  id: string;
  number: number;
  name: string;
  kana: string;
  position: PlayerPosition;
  height: number;
  weight: number;
  apps: number;
  goals: number;
  assists: number;
}

export interface PlayersData {
  season: string;
  players: Player[];
}

export interface SeasonSummary {
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface SeasonArchive {
  id: SeasonId;
  label: string;
  competition: string;
  manager: string;
  note: string;
  summary: SeasonSummary;
  standings: StandingRow[];
  matches: Match[];
  players: Player[];
}

export type VideoSource = 'bellmare' | 'jleague';

export interface VideoItem {
  id: string;
  youtube_id: string;
  title: string;
  source: VideoSource;
  channel_name: string;
  season: SeasonId;
  published_at: string;
  tags: string[];
  match_id: string | null;
  player_ids: string[];
  manual_override: boolean;
}

export interface VideosData {
  updated_at: string;
  videos: VideoItem[];
}

export interface BusScheduleItem {
  note: string;
  interval: string;
}

export interface StadiumInfo {
  name: string;
  address: string;
  walk_info: string;
  bus_boarding: string;
  bus_official_url: string;
  bus_schedules: {
    weekend: BusScheduleItem[];
    weekday: BusScheduleItem[];
  };
}

export interface Chant {
  id: string;
  category: string;
  player_number?: number;
  title: string;
  timing: string;
  lyrics: string;
}

export interface StadiumGuideData {
  stadium: StadiumInfo;
  chants: Chant[];
}

export interface HubDataBundle {
  meta: MetaData;
  seasons: Record<SeasonId, SeasonArchive>;
  videos: VideosData;
  stadiumGuide: StadiumGuideData;
}

export type DataSource = 'live' | 'cache' | 'fallback';
export type TabId = 'home' | 'matches' | 'players' | 'videos' | 'stadium';
export type MatchOutcome = 'W' | 'D' | 'L';
