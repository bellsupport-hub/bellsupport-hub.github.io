import { useCallback, useEffect, useState } from 'react';
import { FALLBACK_DATA } from '../data/fallbackData';
import type {
  DataSource,
  HubDataBundle,
  MetaData,
  SeasonArchive,
  SeasonId,
  StadiumGuideData,
  VideosData,
} from '../types';

const CACHE_KEY = 'bellsupport_hub_api_cache_v2';
const SEASON_IDS: SeasonId[] = [
  '2026-27',
  '2026-special',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
];

function readCachedBundle(): HubDataBundle | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubDataBundle;
    if (
      parsed &&
      parsed.meta &&
      parsed.seasons &&
      parsed.seasons['2026-27'] &&
      parsed.videos &&
      parsed.stadiumGuide
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedBundle(bundle: HubDataBundle): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(relativePath, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${relativePath}`);
  }
  return (await response.json()) as T;
}

export function useHubData() {
  const initialCache = typeof window !== 'undefined' ? readCachedBundle() : null;

  const [data, setData] = useState<HubDataBundle>(initialCache ?? FALLBACK_DATA);
  const [source, setSource] = useState<DataSource>(initialCache ? 'cache' : 'fallback');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOfflineError, setIsOfflineError] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const base = import.meta.env.BASE_URL || './';
      const prefix = base.endsWith('/') ? `${base}api/v1/` : `${base}/api/v1/`;

      const [meta, videos, stadiumGuide, clubHistoryRaw, ...seasonArchives] = await Promise.all([
        fetchJson<MetaData>(`${prefix}meta.json`),
        fetchJson<VideosData>(`${prefix}videos.json`),
        fetchJson<StadiumGuideData>(`${prefix}stadium_guide.json`),
        fetchJson<{ records?: HubDataBundle['clubHistory'] }>(`${prefix}club_history.json`).catch(
          () => ({ records: [] })
        ),
        ...SEASON_IDS.map((id) => fetchJson<SeasonArchive>(`${prefix}seasons/${id}.json`)),
      ]);

      const seasons = {} as Record<SeasonId, SeasonArchive>;
      SEASON_IDS.forEach((id, idx) => {
        seasons[id] = seasonArchives[idx];
      });

      const freshBundle: HubDataBundle = {
        meta,
        seasons,
        videos,
        stadiumGuide,
        clubHistory: clubHistoryRaw.records ?? [],
      };

      setData(freshBundle);
      setSource('live');
      setIsOfflineError(false);
      writeCachedBundle(freshBundle);
    } catch {
      const cached = readCachedBundle();
      if (cached) {
        setData(cached);
        setSource('cache');
      } else {
        setData(FALLBACK_DATA);
        setSource('fallback');
      }
      setIsOfflineError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    data,
    source,
    isLoading,
    isOfflineError,
    refresh: loadData,
  };
}
