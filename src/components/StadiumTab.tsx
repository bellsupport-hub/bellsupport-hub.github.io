import { useMemo, useState } from 'react';
import { ExternalLink, Map as MapIcon, MapPin, Search, Ticket, X } from 'lucide-react';
import type { Match, SeasonArchive, StadiumGuideData, WatchStatus } from '../types';
import { getGoogleMapsUrl, getStadiumInfo, getTeamFullName } from '../utils/clubMeta';
import { formatKickoffDate, formatKickoffTime, getMatchOutcome } from '../utils/format';
import { TeamFlag, VenuePin } from './TeamFlag';

type SubTab = 'guide' | 'venues' | 'pending';
type VenueFilter = 'all' | 'home' | 'away' | 'visited';

interface StadiumTabProps {
  stadiumGuide: StadiumGuideData;
  allMatches: Match[];
  currentSeason: SeasonArchive;
  getWatchStatus: (matchId: string) => WatchStatus;
}

interface VenueStats {
  key: string;
  name: string;
  shorts: string[];
  isHome: boolean;
  opponents: string[];
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  scheduled: number;
  visitedCount: number;
}

export function StadiumTab({
  stadiumGuide,
  allMatches,
  currentSeason,
  getWatchStatus,
}: StadiumTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('guide');
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
  const [venueQuery, setVenueQuery] = useState('');

  const { stadium } = stadiumGuide;

  const venueDirectory = useMemo<VenueStats[]>(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        shorts: Set<string>;
        isHome: boolean;
        opponents: Set<string>;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        gf: number;
        ga: number;
        scheduled: number;
        visitedCount: number;
      }
    >();

    for (const m of allMatches) {
      const info = getStadiumInfo(m.stadium);
      const key = info.query;
      let rec = map.get(key);
      if (!rec) {
        rec = {
          key,
          name: info.name,
          shorts: new Set([m.stadium]),
          isHome: m.is_home,
          opponents: new Set(),
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          scheduled: 0,
          visitedCount: 0,
        };
        map.set(key, rec);
      }
      rec.shorts.add(m.stadium);
      if (m.is_home) rec.isHome = true;
      else rec.opponents.add(m.opponent);

      if (getWatchStatus(m.id).stadium) {
        rec.visitedCount += 1;
      }

      if (m.status === 'finished' && m.result) {
        rec.played += 1;
        rec.gf += m.result.bellmare_score;
        rec.ga += m.result.opponent_score;
        const outcome = getMatchOutcome(m);
        if (outcome === 'W') rec.won += 1;
        else if (outcome === 'D') rec.drawn += 1;
        else if (outcome === 'L') rec.lost += 1;
      } else {
        rec.scheduled += 1;
      }
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        shorts: Array.from(r.shorts),
        opponents: Array.from(r.opponents),
      }))
      .sort((a, b) => {
        if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
        return b.played + b.scheduled - (a.played + a.scheduled);
      });
  }, [allMatches, getWatchStatus]);

  const homeRecord = venueDirectory.find((v) => v.key === 'レモンガススタジアム平塚');
  const awayVenues = venueDirectory.filter((v) => !v.isHome);
  const visitedAwayCount = awayVenues.filter((v) => v.visitedCount > 0).length;

  const upcomingAwayMatches = useMemo(() => {
    return currentSeason.matches
      .filter((m) => m.status === 'scheduled' && !m.is_home)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  }, [currentSeason.matches]);

  const filteredVenues = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    return venueDirectory.filter((v) => {
      if (venueFilter === 'home' && !v.isHome) return false;
      if (venueFilter === 'away' && v.isHome) return false;
      if (venueFilter === 'visited' && v.visitedCount === 0) return false;
      if (!q) return true;
      const hay = `${v.name} ${v.shorts.join(' ')} ${v.opponents.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [venueDirectory, venueFilter, venueQuery]);

  return (
    <div className="tab-content">
      {/* Sub-tab Segmented Control */}
      <div className="segmented-control segmented-control-3" role="tablist" aria-label="スタジアムメニュー">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'guide'}
          className={`segment-btn ${subTab === 'guide' ? 'is-active' : ''}`}
          onClick={() => setSubTab('guide')}
        >
          <MapPin size={15} />
          <span>ホーム＆遠征</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'venues'}
          className={`segment-btn ${subTab === 'venues' ? 'is-active' : ''}`}
          onClick={() => setSubTab('venues')}
        >
          <MapIcon size={15} />
          <span>全会場 ({venueDirectory.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pending'}
          className={`segment-btn ${subTab === 'pending' ? 'is-active' : ''}`}
          onClick={() => setSubTab('pending')}
        >
          <span>情報提供枠</span>
        </button>
      </div>

      {subTab === 'guide' && (
        <div className="section-stack">
          {/* Verified Home Stadium Card */}
          <section className="stadium-hero-card">
            <div className="stadium-hero-top">
              <div>
                <span className="stadium-kicker">HOME STADIUM</span>
                <h2 className="stadium-name">{stadium.name}</h2>
                <p className="stadium-address">
                  <MapPin size={14} />
                  <span>{stadium.address}</span>
                </p>
              </div>
              <a
                href={getGoogleMapsUrl('レモンＳ')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary-accent stadium-map-btn"
              >
                <span>マップ</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {homeRecord && (
              <div className="stadium-home-stats num-font">
                <div className="stadium-home-stat-box">
                  <span>2020〜試合</span>
                  <strong>{homeRecord.played}</strong>
                </div>
                <div className="stadium-home-stat-box">
                  <span>勝-分-敗</span>
                  <strong>
                    {homeRecord.won}-{homeRecord.drawn}-{homeRecord.lost}
                  </strong>
                </div>
                <div className="stadium-home-stat-box">
                  <span>得 / 失</span>
                  <strong>
                    {homeRecord.gf}/{homeRecord.ga}
                  </strong>
                </div>
                <div className="stadium-home-stat-box is-accent">
                  <span>現地観戦</span>
                  <strong>{homeRecord.visitedCount}回</strong>
                </div>
              </div>
            )}

            <div className="stadium-official-links">
              <a
                href="https://www.bellmare.co.jp/stadium"
                target="_blank"
                rel="noopener noreferrer"
                className="stadium-ext-link"
              >
                <span>ベルマーレ公式 アクセス</span>
                <ExternalLink size={13} />
              </a>
              <a
                href={stadium.bus_official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="stadium-ext-link"
              >
                <span>神奈中バス公式</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </section>

          {/* Upcoming Away Trips */}
          <section className="section-block">
            <div className="section-header">
              <h3 className="section-title">
                {currentSeason.label} 今後のアウェイ遠征（{upcomingAwayMatches.length}試合）
              </h3>
              <span className="section-meta">会場タップで地図起動</span>
            </div>

            {upcomingAwayMatches.length > 0 ? (
              <div className="match-list">
                {upcomingAwayMatches.map((m) => (
                  <article key={m.id} className="surface-card away-trip-card">
                    <div className="match-card-head">
                      <span className="round-chip">{m.round}</span>
                      <span className="match-date num-font">
                        {formatKickoffDate(m.kickoff)} {formatKickoffTime(m.kickoff)}
                      </span>
                    </div>
                    <div className="away-trip-row">
                      <div className="match-opponent-row">
                        <span className="vs-prefix">VS</span>
                        <TeamFlag team={m.opponent} size={16} />
                        <strong className="match-opponent-name">
                          {getTeamFullName(m.opponent)}
                        </strong>
                      </div>
                      {m.ticket_url && (
                        <a
                          href={m.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="match-ticket-link"
                        >
                          <Ticket size={13} />
                          <span>チケット</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="away-trip-venue">
                      <VenuePin isHome={false} stadium={m.stadium} clickable showFull />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-card">このシーズンに予定されているアウェイ戦はありません。</div>
            )}
          </section>
        </div>
      )}

      {subTab === 'venues' && (
        <div className="section-stack">
          <div className="surface-card guide-card away-conquest-card">
            <div>
              <p className="guide-card-sub">アウェイスタジアム現地制覇（2020〜2026-27）</p>
              <strong className="conquest-num num-font">
                {visitedAwayCount} <span>/ {awayVenues.length} 会場</span>
              </strong>
            </div>
            <p className="guide-card-sub conquest-hint">
              試合タブで「現地」を記録すると自動集計されます
            </p>
          </div>

          <div className="search-input-wrap">
            <Search size={17} className="search-icon" />
            <input
              type="search"
              className="search-input"
              value={venueQuery}
              onChange={(e) => setVenueQuery(e.target.value)}
              placeholder="スタジアム名・略称・クラブ名で検索"
              aria-label="スタジアムを検索"
            />
            {venueQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setVenueQuery('')}
                aria-label="検索をクリア"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="filter-pills" role="tablist" aria-label="会場フィルタ">
            {(
              [
                { id: 'all', label: `すべて (${venueDirectory.length})` },
                { id: 'home', label: 'HOME' },
                { id: 'away', label: `AWAY (${awayVenues.length})` },
                { id: 'visited', label: '現地訪問済' },
              ] as { id: VenueFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={venueFilter === opt.id}
                className={`filter-pill ${venueFilter === opt.id ? 'is-active' : ''}`}
                onClick={() => setVenueFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="match-list">
            {filteredVenues.map((v) => (
              <article key={v.key} className="surface-card venue-dir-card">
                <div className="venue-dir-top">
                  <div className="venue-dir-title-wrap">
                    <span className={`venue-ha-badge ${v.isHome ? 'is-home' : 'is-away'}`}>
                      {v.isHome ? 'HOME' : 'AWAY'}
                    </span>
                    <h4 className="venue-dir-name">{v.name}</h4>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      v.key
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="venue-dir-map-link"
                  >
                    <span>地図</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div className="venue-dir-meta">
                  <span>表記: {v.shorts.join(' / ')}</span>
                  {v.opponents.length > 0 && (
                    <span className="venue-dir-opponents">
                      {v.opponents.map((op) => (
                        <span key={op} className="team-with-flag">
                          <TeamFlag team={op} size={11} />
                          <span>{op}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div className="venue-dir-record num-font">
                  <span>
                    戦績: <strong>{v.played}戦</strong> {v.won}勝{v.drawn}分{v.lost}敗（
                    {v.gf}得点/{v.ga}失点）{v.scheduled > 0 ? ` + 予定${v.scheduled}` : ''}
                  </span>
                  {v.visitedCount > 0 && (
                    <strong className="venue-visited-badge">現地 {v.visitedCount}回</strong>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {subTab === 'pending' && (
        <section className="surface-card guide-card">
          <h3 className="guide-card-title">事実確認済みデータの追加枠</h3>
          <p className="guide-body-text">
            真偽不明・未確認の仮情報は掲載しない方針のため、以下のコンテンツは公式・事実確認済みの情報が揃い次第、順次追加します。右上の「問合せ」から情報提供も可能です。
          </p>
          <ul className="pending-info-list">
            <li>レモンガススタジアム平塚の最新アクセス・直行シャトルバス案内</li>
            <li>スタジアムグルメ（フードパーク）公式出店情報</li>
            <li>アウェイ各会場の最寄り駅・ビジターゲート・遠征メモ</li>
            <li>事実確認済みの応援チャント集</li>
          </ul>
        </section>
      )}
    </div>
  );
}
