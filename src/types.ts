export interface MetaData {
  updated_at: string;
  schema_version: number;
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
  standings: StandingsData;
  matches: MatchesData;
  players: PlayersData;
  stadiumGuide: StadiumGuideData;
}

export type DataSource = 'live' | 'cache' | 'fallback';
export type TabId = 'home' | 'matches' | 'players' | 'stadium';
export type MatchOutcome = 'W' | 'D' | 'L';
