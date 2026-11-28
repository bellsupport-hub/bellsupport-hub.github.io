import { useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ContactModal } from './components/ContactModal';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { MatchDetailModal } from './components/MatchDetailModal';
import { MatchesTab } from './components/MatchesTab';
import { PlayersTab } from './components/PlayersTab';
import { StadiumTab } from './components/StadiumTab';
import { VideosTab } from './components/VideosTab';
import { useAttendance } from './hooks/useAttendance';
import { useHubData } from './hooks/useHubData';
import type { Match, SeasonId, StandingsData, TabId } from './types';

const SEASON_ORDER: SeasonId[] = [
  '2026-27',
  '2026-special',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [selectedSeasonId, setSelectedSeasonId] = useState<SeasonId>('2026-27');
  const [selectedMatch, setSelectedMatch] = useState<{
    match: Match;
    seasonId: SeasonId;
  } | null>(null);
  const [videoPlayerIdFilter, setVideoPlayerIdFilter] = useState<string | null>(null);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
  const [isContactOpen, setIsContactOpen] = useState<boolean>(false);

  const { data, source, isLoading, isOfflineError, refresh } = useHubData();

  const seasonList = useMemo(
    () => SEASON_ORDER.map((id) => data.seasons[id]).filter(Boolean),
    [data.seasons]
  );

  const currentSeason = data.seasons[selectedSeasonId] ?? data.seasons['2026-27'];

  const allMatchesAcrossSeasons = useMemo(
    () => seasonList.flatMap((s) => s.matches),
    [seasonList]
  );

  const { getWatchStatus, toggleWatch, summary } = useAttendance(allMatchesAcrossSeasons);

  const currentStandingsData: StandingsData = useMemo(
    () => ({
      season: currentSeason.label,
      competition: currentSeason.competition,
      standings: currentSeason.standings,
    }),
    [currentSeason]
  );

  const modalSeason = selectedMatch
    ? data.seasons[selectedMatch.seasonId] ?? currentSeason
    : currentSeason;

  const modalVideos = useMemo(() => {
    if (!selectedMatch) return [];
    return data.videos.videos.filter((v) => v.match_id === selectedMatch.match.id);
  }, [selectedMatch, data.videos.videos]);

  const handleSelectSeason = (seasonId: SeasonId) => {
    setSelectedSeasonId(seasonId);
    setHighlightedPlayerId(null);
  };

  const handleOpenMatch = (match: Match, seasonId: SeasonId = selectedSeasonId) => {
    setSelectedMatch({ match, seasonId });
  };

  const handleViewPlayerVideos = (playerId: string) => {
    setVideoPlayerIdFilter(playerId);
    setActiveTab('videos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToPlayer = (playerId: string, preferredSeasonId?: SeasonId) => {
    setSelectedMatch(null);
    let targetSeason = preferredSeasonId ?? selectedSeasonId;
    if (!data.seasons[targetSeason]?.players.some((p) => p.id === playerId)) {
      const foundSeason = seasonList.find((s) =>
        s.players.some((p) => p.id === playerId)
      );
      if (foundSeason) targetSeason = foundSeason.id;
    }
    setSelectedSeasonId(targetSeason);
    setHighlightedPlayerId(playerId);
    setActiveTab('players');
  };

  return (
    <div className="app-shell">
      <Header
        seasons={seasonList}
        selectedSeasonId={selectedSeasonId}
        onSelectSeason={handleSelectSeason}
        updatedAt={data.meta.updated_at}
        source={source}
        isLoading={isLoading}
        isOfflineError={isOfflineError}
        onRefresh={refresh}
        onOpenContact={() => setIsContactOpen(true)}
      />

      <main className="app-main">
        {isOfflineError && (
          <div className="offline-banner" role="status">
            <span>
              オフラインまたは通信エラーのため、
              {source === 'cache' ? '保存済みキャッシュ' : '初期データ'}を表示しています。
            </span>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeTab
            matches={currentSeason.matches}
            standings={currentStandingsData}
            clubHistory={data.clubHistory ?? []}
            updatedAt={data.meta.updated_at}
            onSelectMatch={(m) => handleOpenMatch(m, selectedSeasonId)}
            onGoToMatches={() => setActiveTab('matches')}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesTab
            matches={currentSeason.matches}
            getWatchStatus={getWatchStatus}
            onToggleWatch={toggleWatch}
            attendanceSummary={summary}
            onSelectMatch={(m) => handleOpenMatch(m, selectedSeasonId)}
          />
        )}

        {activeTab === 'players' && (
          <PlayersTab
            players={currentSeason.players}
            seasonLabel={currentSeason.label}
            videos={data.videos.videos}
            highlightedPlayerId={highlightedPlayerId}
            onViewPlayerVideos={handleViewPlayerVideos}
          />
        )}

        {activeTab === 'videos' && (
          <VideosTab
            videos={data.videos.videos}
            seasons={data.seasons}
            seasonOrder={SEASON_ORDER}
            initialPlayerIdFilter={videoPlayerIdFilter}
            onClearPlayerFilter={() => setVideoPlayerIdFilter(null)}
            onOpenMatch={handleOpenMatch}
            onJumpToPlayer={handleJumpToPlayer}
          />
        )}

        {activeTab === 'stadium' && (
          <StadiumTab
            stadiumGuide={data.stadiumGuide}
            currentSeason={currentSeason}
          />
        )}

        <footer className="app-footer">
          <p className="footer-disclaimer">
            <strong>※非公式サポーターアプリ</strong>
            <br />
            本サイトは湘南ベルマーレおよびJリーグとは一切関係のない個人の非公式ファンサイトです。掲載している試合結果・出場記録は公表されている公式記録に基づき、動画は公式YouTubeチャンネルの公式埋め込み機能を使用しています。各クラブ・大会等の名称・商標・著作権はそれぞれの権利者に帰属します。最新・正確な情報は公式サイトをご確認ください。
          </p>
        </footer>
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      <MatchDetailModal
        match={selectedMatch?.match ?? null}
        players={modalSeason.players}
        videos={modalVideos}
        watchStatus={
          selectedMatch
            ? getWatchStatus(selectedMatch.match.id)
            : { stadium: false, online: false }
        }
        onToggleWatch={toggleWatch}
        onJumpToPlayer={(pid) => handleJumpToPlayer(pid, modalSeason.id)}
        onClose={() => setSelectedMatch(null)}
      />

      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
