import { useEffect, useMemo, useState } from 'react';
import {
  Bus,
  ExternalLink,
  Footprints,
  MapPin,
  Maximize2,
  Minus,
  Music2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { Chant, StadiumGuideData } from '../types';

type SubTab = 'access' | 'chants';
type DayType = 'weekend' | 'weekday';

interface StadiumTabProps {
  stadiumGuide: StadiumGuideData;
}

export function StadiumTab({ stadiumGuide }: StadiumTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('access');
  const [dayType, setDayType] = useState<DayType>('weekend');
  const [chantQuery, setChantQuery] = useState('');
  const [chantCategory, setChantCategory] = useState<string>('すべて');
  const [selectedChant, setSelectedChant] = useState<Chant | null>(null);
  const [chantFontSize, setChantFontSize] = useState<number>(28);

  const { stadium, chants } = stadiumGuide;

  const categories = useMemo(() => {
    const unique = Array.from(new Set(chants.map((c) => c.category)));
    return ['すべて', ...unique];
  }, [chants]);

  const filteredChants = useMemo(() => {
    const q = chantQuery.trim().toLowerCase();
    return chants.filter((c) => {
      if (chantCategory !== 'すべて' && c.category !== chantCategory) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.lyrics.toLowerCase().includes(q) ||
        c.timing.toLowerCase().includes(q) ||
        (c.player_number !== undefined && String(c.player_number).includes(q))
      );
    });
  }, [chants, chantCategory, chantQuery]);

  useEffect(() => {
    if (!selectedChant) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedChant(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedChant]);

  const activeBusSchedules =
    dayType === 'weekend' ? stadium.bus_schedules.weekend : stadium.bus_schedules.weekday;

  return (
    <div className="tab-content">
      {/* Sub-tab Segmented Control */}
      <div className="segmented-control" role="tablist" aria-label="スタジアム・応援メニュー">
        <button
          type="button"
          id="stadium-subtab-access"
          role="tab"
          aria-selected={subTab === 'access'}
          className={`segment-btn ${subTab === 'access' ? 'is-active' : ''}`}
          onClick={() => setSubTab('access')}
        >
          <Bus size={16} />
          <span>アクセス・バス</span>
        </button>
        <button
          type="button"
          id="stadium-subtab-chants"
          role="tab"
          aria-selected={subTab === 'chants'}
          className={`segment-btn ${subTab === 'chants' ? 'is-active' : ''}`}
          onClick={() => setSubTab('chants')}
        >
          <Music2 size={16} />
          <span>チャント集</span>
        </button>
      </div>

      {subTab === 'access' ? (
        <div className="section-stack">
          {/* Stadium Overview */}
          <section className="stadium-hero-card">
            <span className="stadium-kicker">HOME STADIUM</span>
            <h2 className="stadium-name">{stadium.name}</h2>
            <p className="stadium-address">
              <MapPin size={15} />
              <span>{stadium.address}</span>
            </p>
          </section>

          {/* Walk Info */}
          <section className="surface-card guide-card">
            <div className="guide-card-head">
              <span className="guide-icon-badge is-green">
                <Footprints size={18} />
              </span>
              <div>
                <h3 className="guide-card-title">徒歩アクセス</h3>
                <p className="guide-card-sub">JR平塚駅からのルート</p>
              </div>
            </div>
            <p className="guide-body-text">{stadium.walk_info}</p>
          </section>

          {/* Bus Schedule Card */}
          <section className="surface-card guide-card">
            <div className="guide-card-head">
              <span className="guide-icon-badge is-blue">
                <Bus size={18} />
              </span>
              <div>
                <h3 className="guide-card-title">シャトルバス・路線バス</h3>
                <p className="guide-card-sub">{stadium.bus_boarding}</p>
              </div>
            </div>

            <div className="day-toggle-row" role="tablist" aria-label="曜日切替">
              <button
                type="button"
                id="bus-day-weekend"
                role="tab"
                aria-selected={dayType === 'weekend'}
                className={`day-toggle-btn ${dayType === 'weekend' ? 'is-active' : ''}`}
                onClick={() => setDayType('weekend')}
              >
                土日祝ダイヤ
              </button>
              <button
                type="button"
                id="bus-day-weekday"
                role="tab"
                aria-selected={dayType === 'weekday'}
                className={`day-toggle-btn ${dayType === 'weekday' ? 'is-active' : ''}`}
                onClick={() => setDayType('weekday')}
              >
                平日ナイター等
              </button>
            </div>

            <ul className="bus-schedule-list">
              {activeBusSchedules.map((item) => (
                <li key={item.note} className="bus-schedule-item">
                  <strong className="bus-time-note">{item.note}</strong>
                  <span className="bus-interval">{item.interval}</span>
                </li>
              ))}
            </ul>

            <a
              href={stadium.bus_official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brand-full"
            >
              <span>神奈中バス 公式サイトで最新時刻を確認</span>
              <ExternalLink size={15} />
            </a>
          </section>
        </div>
      ) : (
        <div className="section-stack">
          {/* Chant Search & Category Filter */}
          <div className="search-input-wrap">
            <Search size={17} className="search-icon" />
            <input
              type="search"
              id="chant-search-input"
              className="search-input"
              value={chantQuery}
              onChange={(e) => setChantQuery(e.target.value)}
              placeholder="チャント名・歌詞・背番号で検索"
              aria-label="チャントを検索"
            />
            {chantQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setChantQuery('')}
                aria-label="検索をクリア"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="filter-pills" role="tablist" aria-label="チャントカテゴリ">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={chantCategory === cat}
                className={`filter-pill ${chantCategory === cat ? 'is-active' : ''}`}
                onClick={() => setChantCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <p className="chant-tip-note">
            カードをタップすると、スタンドで片手でも見やすい大文字モードで拡大表示します。
          </p>

          {filteredChants.length > 0 ? (
            <div className="chants-list">
              {filteredChants.map((chant) => (
                <button
                  key={chant.id}
                  type="button"
                  className="surface-card chant-card"
                  onClick={() => setSelectedChant(chant)}
                >
                  <div className="chant-card-top">
                    <div className="chant-badges">
                      <span className="chant-cat-badge">{chant.category}</span>
                      {chant.player_number !== undefined && (
                        <span className="chant-num-badge num-font">
                          #{chant.player_number}
                        </span>
                      )}
                    </div>
                    <span className="chant-expand-hint">
                      <Maximize2 size={14} />
                      <span>拡大表示</span>
                    </span>
                  </div>

                  <h3 className="chant-title">{chant.title}</h3>
                  <p className="chant-timing">タイミング：{chant.timing}</p>
                  <p className="chant-preview">{chant.lyrics}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-card">該当するチャントが見つかりませんでした。</div>
          )}
        </div>
      )}

      {/* One-handed Large Text Chant Fullscreen Modal */}
      {selectedChant && (
        <div
          className="chant-fullscreen-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chant-modal-title"
        >
          <div className="chant-modal-top">
            <div className="chant-modal-badges">
              <span className="chant-modal-cat">{selectedChant.category}</span>
              {selectedChant.player_number !== undefined && (
                <span className="chant-modal-num num-font">
                  #{selectedChant.player_number}
                </span>
              )}
            </div>
            <h2 id="chant-modal-title" className="chant-modal-title">
              {selectedChant.title}
            </h2>
            <p className="chant-modal-timing">{selectedChant.timing}</p>
          </div>

          <div className="chant-modal-lyrics-area">
            <p
              className="chant-modal-lyrics"
              style={{ fontSize: `${chantFontSize}px` }}
            >
              {selectedChant.lyrics}
            </p>
          </div>

          {/* Thumb-reachable Bottom Controls */}
          <div className="chant-modal-controls">
            <div className="font-size-controls" aria-label="文字サイズ調整">
              <button
                type="button"
                className="font-size-btn"
                onClick={() => setChantFontSize((s) => Math.max(20, s - 4))}
                aria-label="文字を小さくする"
              >
                <Minus size={18} />
                <span>小</span>
              </button>
              <span className="font-size-readout num-font">{chantFontSize}px</span>
              <button
                type="button"
                className="font-size-btn"
                onClick={() => setChantFontSize((s) => Math.min(44, s + 4))}
                aria-label="文字を大きくする"
              >
                <Plus size={18} />
                <span>大</span>
              </button>
            </div>

            <button
              type="button"
              id="close-chant-modal-btn"
              className="chant-close-large-btn"
              onClick={() => setSelectedChant(null)}
            >
              <X size={20} />
              <span>閉じる</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
