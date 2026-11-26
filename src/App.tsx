import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { MatchDetailModal } from './components/MatchDetailModal';
import { MatchesTab } from './components/MatchesTab';
import { PlayersTab } from './components/PlayersTab';
import { StadiumTab } from './components/StadiumTab';
import { useAttendance } from './hooks/useAttendance';
import { useHubData } from './hooks/useHubData';
import type { Match, TabId } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const { data, source, isLoading, isOfflineError, refresh } = useHubData();
  const { isAttended, toggleAttended, summary } = useAttendance(data.matches.matches);

  return (
    <div className="app-shell">
      <Header
        season={data.standings.season}
        updatedAt={data.meta.updated_at}
        source={source}
        isLoading={isLoading}
        isOfflineError={isOfflineError}
        onRefresh={refresh}
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
            matches={data.matches.matches}
            standings={data.standings}
            updatedAt={data.meta.updated_at}
            onSelectMatch={setSelectedMatch}
            onGoToMatches={() => setActiveTab('matches')}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesTab
            matches={data.matches.matches}
            isAttended={isAttended}
            onToggleAttended={toggleAttended}
            attendanceSummary={summary}
            onSelectMatch={setSelectedMatch}
          />
        )}

        {activeTab === 'players' && (
          <PlayersTab
            players={data.players.players}
            season={data.players.season}
          />
        )}

        {activeTab === 'stadium' && (
          <StadiumTab stadiumGuide={data.stadiumGuide} />
        )}

        <footer className="app-footer">
          <p className="footer-disclaimer">
            <strong>※非公式サポーターアプリ</strong>
            <br />
            本アプリは湘南ベルマーレおよびJリーグとは一切関係のない個人の非公式アプリです。掲載しているデータ・チャント等はサンプルまたは独自編集データを含みます。最新・正確な情報は公式サイトをご確認ください。
          </p>
        </footer>
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      <MatchDetailModal
        match={selectedMatch}
        players={data.players.players}
        isAttended={selectedMatch ? isAttended(selectedMatch.id) : false}
        onToggleAttended={toggleAttended}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
