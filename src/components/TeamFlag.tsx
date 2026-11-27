import { ExternalLink, Home, MapPin } from 'lucide-react';
import { getGoogleMapsUrl, getStadiumInfo, getTeamColors } from '../utils/clubMeta';

interface TeamFlagProps {
  team: string;
  size?: number;
}

export function TeamFlag({ team, size = 15 }: TeamFlagProps) {
  const [c1, c2] = getTeamColors(team);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className="team-flag-svg"
      aria-hidden="true"
    >
      <rect x="2" y="1.5" width="1.8" height="15" rx="0.9" fill="#94a3b8" />
      <path d="M4.2 2.2 L16.2 4.2 L16.2 8.2 L4.2 7.2 Z" fill={c1} />
      <path d="M4.2 7.2 L16.2 8.2 L16.2 11.8 L4.2 12.2 Z" fill={c2} />
      <path
        d="M4.2 2.2 L16.2 4.2 L16.2 11.8 L4.2 12.2 Z"
        fill="none"
        stroke="rgba(15,23,42,0.22)"
        strokeWidth="0.6"
      />
    </svg>
  );
}

interface VenuePinProps {
  isHome: boolean;
  stadium: string;
  clickable?: boolean;
  darkBg?: boolean;
  showFull?: boolean;
}

export function VenuePin({
  isHome,
  stadium,
  clickable = false,
  darkBg = false,
  showFull = false,
}: VenuePinProps) {
  const info = getStadiumInfo(stadium);
  const label = showFull ? info.name : info.short;

  const content = (
    <>
      {isHome ? (
        <Home size={13} className="venue-pin-icon is-home" aria-hidden="true" />
      ) : (
        <MapPin size={13} className="venue-pin-icon is-away" aria-hidden="true" />
      )}
      <span className={`venue-ha-badge ${isHome ? 'is-home' : 'is-away'}`}>
        {isHome ? 'HOME' : 'AWAY'}
      </span>
      <span className="venue-name-text">{label}</span>
      {clickable && <ExternalLink size={12} className="venue-map-ext" aria-hidden="true" />}
    </>
  );

  if (clickable) {
    return (
      <a
        href={getGoogleMapsUrl(stadium)}
        target="_blank"
        rel="noopener noreferrer"
        className={`venue-pin-link ${darkBg ? 'is-dark' : ''}`}
        title={`Googleマップで ${info.name} を開く`}
      >
        {content}
      </a>
    );
  }

  return <span className="venue-pin-inline">{content}</span>;
}
