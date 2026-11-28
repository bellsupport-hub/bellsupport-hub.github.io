import { useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, Music, Play, Sparkles, Ticket } from 'lucide-react';
import type { SeasonArchive, StadiumGuideData } from '../types';
import { getGoogleMapsUrl, getTeamFullName } from '../utils/clubMeta';
import { formatKickoffDate, formatKickoffTime } from '../utils/format';
import { TeamFlag, VenuePin } from './TeamFlag';

type SubTab = 'guide' | 'chants' | 'dance';

interface StadiumTabProps {
  stadiumGuide: StadiumGuideData;
  currentSeason: SeasonArchive;
}

interface ChantChapter {
  timeLabel: string;
  startSec: number;
  title: string;
}

const CHANT_VIDEO_ID = 'jIBv3_JHnG8';
const CHANT_VIDEO_TITLE = '【俺らは歌うのさ 湘南の為に】湘南ベルマーレ チャント集';
const CHANT_VIDEO_META = '2026.11.14 vs 横浜FC @レモンガススタジアム平塚（J.LEAGUE LIFE）';

const CHANT_CHAPTERS: ChantChapter[] = [
  { timeLabel: '00:00', startSec: 0, title: '俺たちの湘南' },
  { timeLabel: '02:00', startSec: 120, title: 'どんな時も俺の誇り' },
  { timeLabel: '04:21', startSec: 261, title: 'ビッグウェーブ' },
  { timeLabel: '05:54', startSec: 354, title: 'ラピュタ' },
  { timeLabel: '08:19', startSec: 499, title: '湘南コール' },
  { timeLabel: '08:29', startSec: 509, title: '闘え湘南' },
  { timeLabel: '10:10', startSec: 610, title: 'それ行け湘南' },
  { timeLabel: '11:06', startSec: 666, title: 'ベルマーレオーレ' },
  { timeLabel: '11:55', startSec: 715, title: 'バモ湘南' },
  { timeLabel: '13:06', startSec: 786, title: '大脱走' },
  { timeLabel: '14:52', startSec: 892, title: '湘南コール' },
  { timeLabel: '15:11', startSec: 911, title: '最後に踊るため' },
  { timeLabel: '16:46', startSec: 1006, title: '勝利を掴み取れ' },
  { timeLabel: '19:11', startSec: 1151, title: '勇者湘南' },
  { timeLabel: '21:03', startSec: 1263, title: '猪突猛進' },
  { timeLabel: '21:23', startSec: 1283, title: '得点' },
  { timeLabel: '21:34', startSec: 1294, title: 'One Bellmare' },
  { timeLabel: '22:28', startSec: 1348, title: 'バモバモス湘南' },
  { timeLabel: '23:59', startSec: 1439, title: '山田 寛人' },
  { timeLabel: '24:55', startSec: 1495, title: '俺たちの声' },
  { timeLabel: '28:05', startSec: 1685, title: 'いつでもどこでも' },
  { timeLabel: '30:09', startSec: 1809, title: '最後に踊ろう' },
  { timeLabel: '32:18', startSec: 1938, title: 'VAMO湘南' },
  { timeLabel: '33:24', startSec: 2004, title: 'アレアレ湘南' },
  { timeLabel: '35:12', startSec: 2112, title: '得点' },
  { timeLabel: '36:12', startSec: 2172, title: '自分を信じ、仲間を信じ' },
  { timeLabel: '40:36', startSec: 2436, title: 'ビッグウェーブ' },
  { timeLabel: '41:49', startSec: 2509, title: '勝利の歌' },
  { timeLabel: '42:43', startSec: 2563, title: '選手挨拶〜ウォーキング' },
];

export function StadiumTab({ stadiumGuide, currentSeason }: StadiumTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('guide');
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [autoplayChant, setAutoplayChant] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const chantPlayerRef = useRef<HTMLDivElement | null>(null);

  const { stadium } = stadiumGuide;

  const upcomingAwayMatches = useMemo(() => {
    return currentSeason.matches
      .filter((m) => m.status === 'scheduled' && !m.is_home)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  }, [currentSeason.matches]);

  const activeChapter = CHANT_CHAPTERS[activeChapterIdx] ?? CHANT_CHAPTERS[0];

  const handleSelectChapter = (idx: number) => {
    setActiveChapterIdx(idx);
    setAutoplayChant(true);
    setPlayNonce((n) => n + 1);
    chantPlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

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
          aria-selected={subTab === 'chants'}
          className={`segment-btn ${subTab === 'chants' ? 'is-active' : ''}`}
          onClick={() => setSubTab('chants')}
        >
          <Music size={15} />
          <span>応援チャント集</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'dance'}
          className={`segment-btn ${subTab === 'dance' ? 'is-active' : ''}`}
          onClick={() => setSubTab('dance')}
        >
          <Sparkles size={15} />
          <span>勝利のダンス</span>
        </button>
      </div>

      {/* Sub-tab 1: Home & Away Trips */}
      {subTab === 'guide' && (
        <div className="section-stack">
          <section className="stadium-hero-card">
            <div className="stadium-hero-top">
              <div className="stadium-hero-info">
                <span className="stadium-kicker">HOME STADIUM</span>
                <h2 className="stadium-name">{stadium.name}</h2>
                <p className="stadium-address">
                  <MapPin size={14} className="shrink-icon" />
                  <span>{stadium.address}</span>
                </p>
              </div>
              <a
                href={getGoogleMapsUrl('レモンＳ')}
                target="_blank"
                rel="noopener noreferrer"
                className="stadium-map-btn"
              >
                <span>マップ</span>
                <ExternalLink size={13} />
              </a>
            </div>

            <div className="stadium-official-links">
              <a
                href="https://www.bellmare.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="stadium-ext-link"
              >
                <span>湘南ベルマーレ公式サイト</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </section>

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
                    <div className="away-trip-head">
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

      {/* Sub-tab 2: Official Chants (Chapter-cued YouTube player) */}
      {subTab === 'chants' && (
        <div className="section-stack">
          <section className="surface-card video-card" ref={chantPlayerRef}>
            <div className="video-embed-frame">
              <iframe
                key={`${CHANT_VIDEO_ID}-${activeChapter.startSec}-${playNonce}`}
                src={`https://www.youtube-nocookie.com/embed/${CHANT_VIDEO_ID}?start=${activeChapter.startSec}&rel=0&playsinline=1${autoplayChant ? '&autoplay=1' : ''}`}
                title={`${CHANT_VIDEO_TITLE} - ${activeChapter.title}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="video-card-body">
              <div className="video-card-meta">
                <span className="chant-now-badge num-font">
                  <Play size={11} />
                  <span>
                    {activeChapter.timeLabel} {activeChapter.title}
                  </span>
                </span>
                <a
                  href={`https://www.youtube.com/watch?v=${CHANT_VIDEO_ID}&t=${activeChapter.startSec}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-card-yt-inline"
                >
                  <span>YouTubeで開く</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <h4 className="video-card-title">{CHANT_VIDEO_TITLE}</h4>
              <p className="chant-video-sub">{CHANT_VIDEO_META}</p>
            </div>
          </section>

          <section className="section-block">
            <div className="section-header">
              <h3 className="section-title">チャプター頭出し（全{CHANT_CHAPTERS.length}曲）</h3>
              <span className="section-meta">タップで即頭出し</span>
            </div>
            <div className="chant-chapter-grid">
              {CHANT_CHAPTERS.map((ch, idx) => {
                const isActive = idx === activeChapterIdx;
                return (
                  <button
                    key={`${ch.timeLabel}-${ch.title}`}
                    type="button"
                    className={`chant-chapter-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleSelectChapter(idx)}
                  >
                    <span className="chant-chapter-time num-font">{ch.timeLabel}</span>
                    <span className="chant-chapter-title">{ch.title}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Sub-tab 3: Victory Dance (WIP) */}
      {subTab === 'dance' && (
        <section className="surface-card guide-card">
          <div className="chant-wip-head">
            <h3 className="guide-card-title">勝利のダンス</h3>
            <span className="chant-wip-badge">準備中</span>
          </div>
          <p className="guide-body-text">
            勝利のダンス動画コレクションは現在準備中です。公開までしばらくお待ちください。
          </p>
        </section>
      )}
    </div>
  );
}
